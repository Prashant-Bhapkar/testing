import logging
import platform
import re
import shlex
import socket
import subprocess

logger = logging.getLogger(__name__)

CMD_TIMEOUT = 25  # pexpect timeout in seconds


def _fernet():
    from cryptography.fernet import Fernet
    from config import ENCRYPTION_KEY
    return Fernet(ENCRYPTION_KEY.encode())


def encrypt_password(password: str) -> str:
    return _fernet().encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


def ping_host(ip: str, hostname: str = None) -> bool:
    """Try ICMP ping on hostname first, then IP. Returns True if either responds."""
    flag = ["-n", "1", "-w", "2000"] if platform.system().lower() == "windows" else ["-c", "1", "-W", "2"]
    targets = list(dict.fromkeys(t for t in [hostname, ip] if t))
    for target in targets:
        try:
            result = subprocess.run(["ping"] + flag + [target], capture_output=True, timeout=5)
            if result.returncode == 0:
                return True
        except Exception:
            pass
    return False


def _tcp_reachable(ip: str, port: int = 22) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=3):
            return True
    except OSError:
        return False


def _strip_ansi(text: str) -> str:
    return re.sub(r'\x1b\[[0-9;]*[mGKHFJA-Z]', '', text)


def _run_ssh(target: str, username: str, password: str, command: str):
    """
    Run an SSH command using pexpect (real PTY — identical to an interactive terminal).
    target should be the hostname when available so ~/.ssh/config ProxyJump settings apply.
    Returns (connected, output, error_hint).
    """
    try:
        import pexpect
    except ImportError:
        return False, "", "pexpect not installed — run: pip install pexpect"

    args = [
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=10",
        "-o", "UserKnownHostsFile=/dev/null",
        f"{username}@{target}",
        command,
    ]

    try:
        child = pexpect.spawn("ssh", args, timeout=CMD_TIMEOUT, encoding="utf-8")

        # Expect: password prompt, an error, immediate EOF (key auth), or timeout
        idx = child.expect([
            r"[Pp]assword:",
            r"Permission denied",
            r"[Cc]onnection (timed out|refused|reset by peer)",
            r"[Cc]ould not resolve",
            pexpect.TIMEOUT,
            pexpect.EOF,
        ])

        if idx == 0:
            # Got password prompt — send it and wait for output
            child.sendline(password)

            # After sending password: second prompt = wrong creds, EOF = done
            idx2 = child.expect([
                r"[Pp]assword:",
                r"Permission denied",
                pexpect.TIMEOUT,
                pexpect.EOF,
            ], timeout=CMD_TIMEOUT)

            if idx2 in (0, 1):
                child.close(force=True)
                return False, "", "Authentication failed — wrong username or password"
            if idx2 == 2:
                child.close(force=True)
                return False, "", "SSH timed out after authentication"

            # idx2 == EOF — command ran
            output = _strip_ansi((child.before or "").strip())
            return True, output, ""

        elif idx == 1:
            child.close(force=True)
            return False, "", "Authentication failed — wrong username or password"

        elif idx == 2:
            msg = _strip_ansi((child.after or "").strip()) or "Connection failed"
            child.close(force=True)
            return False, "", msg

        elif idx == 3:
            child.close(force=True)
            return False, "", "Could not resolve hostname — check hostname/IP"

        elif idx == 4:
            child.close(force=True)
            return False, "", "SSH connection timed out"

        else:
            # EOF without password prompt — could be key-based auth success or error
            output = _strip_ansi((child.before or "").strip())
            exit_status = child.exitstatus
            if exit_status == 0 or (exit_status is None and output):
                return True, output, ""
            return False, "", output or "SSH connection failed"

    except Exception as e:
        logger.warning("SSH error for %s: %s", target, e)
        return False, "", str(e)


def open_ssh_terminal(ip: str, username: str, encrypted_password: str, hostname: str = None) -> dict:
    """Spawn a terminal window on the local machine with an SSH session already logged in."""
    import os
    target = hostname or ip
    ssh_target = f"{username}@{target}"
    # Keep terminal open after SSH exits so the user can see any errors
    shell_cmd = (
        f"sshpass -e ssh -o StrictHostKeyChecking=no {ssh_target}; "
        f"echo ''; echo '--- Session ended ---'; read -p 'Press Enter to close'"
    )

    env = os.environ.copy()
    env["SSHPASS"] = decrypt_password(encrypted_password)
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0"

    # Try common terminal emulators in order
    terminal_cmds = [
        ["gnome-terminal", "--", "bash", "-c", shell_cmd],
        ["xfce4-terminal", "--command", f"bash -c {shlex.quote(shell_cmd)}"],
        ["konsole", "-e", "bash", "-c", shell_cmd],
        ["xterm", "-e", f"bash -c {shlex.quote(shell_cmd)}"],
        ["lxterminal", "-e", f"bash -c {shlex.quote(shell_cmd)}"],
    ]

    for cmd in terminal_cmds:
        try:
            subprocess.Popen(cmd, env=env, start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"success": True, "message": f"Terminal opened for {target}"}
        except FileNotFoundError:
            continue

    return {"success": False, "message": "No terminal emulator found — install gnome-terminal or xterm"}


def check_runner_status(ip: str, username: str, encrypted_password: str, hostname: str = None) -> dict:
    # Use hostname when available so ~/.ssh/config (ProxyJump etc.) applies
    target = hostname or ip

    if not _tcp_reachable(ip):
        return {"connected": False, "running": False, "output": "Port 22 unreachable — check network/firewall"}

    password = decrypt_password(encrypted_password)
    connected, output, err = _run_ssh(
        target, username, password,
        "systemctl is-active gitlab-runner 2>/dev/null || gitlab-runner status 2>&1 | head -5",
    )

    if not connected:
        return {"connected": False, "running": False, "output": err}

    running = output.lower() == "active" or "running" in output.lower()
    return {"connected": True, "running": running, "output": output}


def restart_runner(ip: str, username: str, encrypted_password: str, hostname: str = None) -> dict:
    target = hostname or ip

    if not _tcp_reachable(ip):
        return {"success": False, "output": "Port 22 unreachable — cannot connect"}

    password = decrypt_password(encrypted_password)
    cmd = (
        f"echo {shlex.quote(password)} | sudo -S systemctl restart gitlab-runner 2>&1 || "
        f"echo {shlex.quote(password)} | sudo -S service gitlab-runner restart 2>&1"
    )
    connected, output, err = _run_ssh(target, username, password, cmd)

    if not connected:
        return {"success": False, "output": err}

    return {"success": True, "output": output or "Runner restarted successfully"}
