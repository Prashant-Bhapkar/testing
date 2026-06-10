import logging
import platform
import shlex
import socket
import subprocess

import paramiko

logger = logging.getLogger(__name__)

SSH_TIMEOUT = 6      # seconds for TCP connect + banner
CMD_TIMEOUT = 8      # seconds to wait for remote command output


def _fernet():
    from cryptography.fernet import Fernet
    from config import ENCRYPTION_KEY
    return Fernet(ENCRYPTION_KEY.encode())


def encrypt_password(password: str) -> str:
    return _fernet().encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


def ping_host(ip: str) -> bool:
    """ICMP ping — may return False on networks that block ICMP even if the machine is alive."""
    flag = ["-n", "1", "-w", "2000"] if platform.system().lower() == "windows" else ["-c", "1", "-W", "2"]
    try:
        result = subprocess.run(["ping"] + flag + [ip], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


def _tcp_reachable(ip: str, port: int = 22) -> bool:
    """Quick TCP-level check on port 22 before attempting a full SSH handshake."""
    try:
        with socket.create_connection((ip, port), timeout=3):
            return True
    except OSError:
        return False


def _connect(ip: str, username: str, encrypted_password: str):
    password = decrypt_password(encrypted_password)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        ip, username=username, password=password,
        timeout=SSH_TIMEOUT, banner_timeout=SSH_TIMEOUT,
        auth_timeout=SSH_TIMEOUT,
        look_for_keys=False,   # skip SSH key auth — use password only
        allow_agent=False,     # skip SSH agent — use password only
    )
    transport = client.get_transport()
    if transport is None or not transport.is_active():
        client.close()
        raise paramiko.SSHException("Transport not active after connect")
    return client, password


def check_runner_status(ip: str, username: str, encrypted_password: str) -> dict:
    if not _tcp_reachable(ip):
        return {"connected": False, "running": False, "output": "Port 22 unreachable — check network/firewall"}

    try:
        client, _ = _connect(ip, username, encrypted_password)
        try:
            _, stdout, _ = client.exec_command(
                "systemctl is-active gitlab-runner 2>/dev/null || gitlab-runner status 2>&1 | head -5",
                timeout=CMD_TIMEOUT,
            )
            output = stdout.read().decode().strip()
            running = output.lower() == "active" or "running" in output.lower()
            return {"connected": True, "running": running, "output": output}
        finally:
            client.close()
    except paramiko.AuthenticationException:
        return {"connected": False, "running": False, "output": "Authentication failed — wrong username or password"}
    except (paramiko.SSHException, socket.timeout, TimeoutError) as e:
        logger.warning("SSH check failed for %s: %s", ip, e)
        return {"connected": False, "running": False, "output": "SSH handshake timed out — service may be unresponsive"}
    except Exception as e:
        logger.warning("SSH check failed for %s: %s", ip, e)
        return {"connected": False, "running": False, "output": str(e)}


def restart_runner(ip: str, username: str, encrypted_password: str) -> dict:
    if not _tcp_reachable(ip):
        return {"success": False, "output": "Port 22 unreachable — cannot connect"}

    try:
        client, password = _connect(ip, username, encrypted_password)
        try:
            cmd = (
                f"echo {shlex.quote(password)} | sudo -S systemctl restart gitlab-runner 2>&1 || "
                f"echo {shlex.quote(password)} | sudo -S service gitlab-runner restart 2>&1"
            )
            stdin, stdout, _ = client.exec_command(cmd, timeout=CMD_TIMEOUT)
            stdin.channel.shutdown_write()
            output = stdout.read().decode().strip()
            return {"success": True, "output": output or "Runner restarted successfully"}
        finally:
            client.close()
    except paramiko.AuthenticationException:
        return {"success": False, "output": "Authentication failed — wrong username or password"}
    except Exception as e:
        logger.warning("SSH restart failed for %s: %s", ip, e)
        return {"success": False, "output": str(e)}
