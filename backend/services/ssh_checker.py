import logging
import platform
import shlex
import shutil
import socket
import subprocess

logger = logging.getLogger(__name__)

CMD_TIMEOUT = 20  # seconds for the full SSH command

_SSH_OPTS = [
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=10",
    "-o", "BatchMode=no",
    "-o", "LogLevel=ERROR",
    "-o", "PubkeyAuthentication=no",
    "-o", "PasswordAuthentication=yes",
]


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


def _run_ssh(ip: str, username: str, password: str, command: str):
    """Run an SSH command via sshpass. Returns (connected, output, error_hint)."""
    sp = shutil.which("sshpass")
    if not sp:
        return False, "", "sshpass not installed — run: sudo apt install sshpass"

    cmd = [sp, "-p", password, "ssh"] + _SSH_OPTS + [f"{username}@{ip}", command]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=CMD_TIMEOUT)
    except subprocess.TimeoutExpired:
        return False, "", "SSH command timed out"

    out = r.stdout.strip()
    err = r.stderr.strip()

    if r.returncode == 0:
        return True, out, ""

    # Exit 255 = SSH-level failure (auth denied, connection error, etc.)
    if r.returncode == 255:
        if "Permission denied" in err or "Authentication failed" in err:
            return False, "", "Authentication failed — wrong username or password"
        if "Connection refused" in err:
            return False, "", "Connection refused — SSH not running on port 22"
        return False, "", err or "SSH connection failed"

    # Non-zero exit but SSH connected — command itself returned non-zero
    return True, out or err, ""


def check_runner_status(ip: str, username: str, encrypted_password: str) -> dict:
    if not _tcp_reachable(ip):
        return {"connected": False, "running": False, "output": "Port 22 unreachable — check network/firewall"}

    password = decrypt_password(encrypted_password)
    connected, output, err = _run_ssh(
        ip, username, password,
        "systemctl is-active gitlab-runner 2>/dev/null || gitlab-runner status 2>&1 | head -5"
    )

    if not connected:
        return {"connected": False, "running": False, "output": err}

    running = output.lower() == "active" or "running" in output.lower()
    return {"connected": True, "running": running, "output": output}


def restart_runner(ip: str, username: str, encrypted_password: str) -> dict:
    if not _tcp_reachable(ip):
        return {"success": False, "output": "Port 22 unreachable — cannot connect"}

    password = decrypt_password(encrypted_password)
    cmd = (
        f"echo {shlex.quote(password)} | sudo -S systemctl restart gitlab-runner 2>&1 || "
        f"echo {shlex.quote(password)} | sudo -S service gitlab-runner restart 2>&1"
    )
    connected, output, err = _run_ssh(ip, username, password, cmd)

    if not connected:
        return {"success": False, "output": err}

    return {"success": True, "output": output or "Runner restarted successfully"}
