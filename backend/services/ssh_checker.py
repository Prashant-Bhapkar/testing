import base64
import hashlib
import logging
import platform
import shlex
import subprocess

import paramiko

logger = logging.getLogger(__name__)


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
        result = subprocess.run(["ping"] + flag + [ip], capture_output=True, timeout=6)
        return result.returncode == 0
    except Exception:
        return False


def _connect(ip: str, username: str, encrypted_password: str):
    password = decrypt_password(encrypted_password)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(ip, username=username, password=password, timeout=10, banner_timeout=10)
    return client, password


def check_runner_status(ip: str, username: str, encrypted_password: str) -> dict:
    try:
        client, _ = _connect(ip, username, encrypted_password)
        try:
            _, stdout, _ = client.exec_command(
                "systemctl is-active gitlab-runner 2>/dev/null || gitlab-runner status 2>&1 | head -5"
            )
            output = stdout.read().decode().strip()
            running = output.lower() == "active" or "running" in output.lower()
            return {"connected": True, "running": running, "output": output}
        finally:
            client.close()
    except Exception as e:
        logger.warning("SSH check failed for %s: %s", ip, e)
        return {"connected": False, "running": False, "output": str(e)}


def restart_runner(ip: str, username: str, encrypted_password: str) -> dict:
    try:
        client, password = _connect(ip, username, encrypted_password)
        try:
            cmd = (
                f"echo {shlex.quote(password)} | sudo -S systemctl restart gitlab-runner 2>&1 || "
                f"echo {shlex.quote(password)} | sudo -S service gitlab-runner restart 2>&1"
            )
            stdin, stdout, _ = client.exec_command(cmd)
            stdin.channel.shutdown_write()
            output = stdout.read().decode().strip()
            return {"success": True, "output": output or "Runner restarted successfully"}
        finally:
            client.close()
    except Exception as e:
        logger.warning("SSH restart failed for %s: %s", ip, e)
        return {"success": False, "output": str(e)}
