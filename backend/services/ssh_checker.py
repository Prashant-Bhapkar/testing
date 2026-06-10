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


def ping_host(ip: str) -> bool:
    flag = ["-n", "1", "-w", "2000"] if platform.system().lower() == "windows" else ["-c", "1", "-W", "2"]
    try:
        result = subprocess.run(["ping"] + flag + [ip], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
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
