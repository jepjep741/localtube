# Using LocalTube with CIFS/SMB Network Shares

LocalTube can scan and stream videos from CIFS/SMB network shares (Windows shares, NAS devices, etc.). Here are several ways to set it up:

## Prerequisites

Install CIFS utilities:
```bash
# Ubuntu/Debian
sudo apt-get install cifs-utils

# RHEL/Fedora/CentOS
sudo dnf install cifs-utils

# Arch Linux
sudo pacman -S cifs-utils
```

## Method 1: Using the CIFS Script (Recommended)

1. Set your CIFS credentials:
```bash
export CIFS_SHARE="//192.168.1.100/Videos"
export CIFS_USERNAME="yourusername"
export CIFS_PASSWORD="yourpassword"
```

2. Run LocalTube with CIFS support:
```bash
./run-podman-cifs.sh
```

This script will:
- Mount your CIFS share to a temporary location
- Start LocalTube containers with access to the mounted share
- Handle all the mounting details for you

## Method 2: Manual CIFS Mount

1. Create a mount point:
```bash
sudo mkdir -p /mnt/videos
```

2. Mount your CIFS share:
```bash
# Basic mount
sudo mount -t cifs //server/share /mnt/videos -o username=user,password=pass

# With more options
sudo mount -t cifs //server/share /mnt/videos -o username=user,password=pass,uid=$(id -u),gid=$(id -g),file_mode=0755,dir_mode=0755,vers=3.0
```

3. Run LocalTube with the mount:
```bash
export VIDEOS_DIR=/mnt/videos
./run-podman.sh
```

## Method 3: Permanent Mount with /etc/fstab

1. Create credentials file:
```bash
sudo nano /etc/samba/credentials
```

Add:
```
username=yourusername
password=yourpassword
domain=WORKGROUP
```

2. Secure the file:
```bash
sudo chmod 600 /etc/samba/credentials
```

3. Add to /etc/fstab:
```
//server/share /mnt/videos cifs credentials=/etc/samba/credentials,uid=1000,gid=1000,file_mode=0755,dir_mode=0755,vers=3.0,_netdev 0 0
```

4. Mount:
```bash
sudo mount -a
```

## Method 4: Using Docker Compose with CIFS Volume

1. Create .env.cifs file:
```bash
cp .env.cifs.example .env.cifs
# Edit .env.cifs with your CIFS details
```

2. Run with docker-compose:
```bash
source .env.cifs
docker-compose -f docker-compose-cifs.yml up -d
```

## Method 5: Systemd Service (Auto-mount on boot)

1. Copy the service file:
```bash
sudo cp systemd/localtube-cifs.service /etc/systemd/system/
```

2. Create mount directory:
```bash
sudo mkdir -p /mnt/localtube-videos
```

3. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable localtube-cifs.service
sudo systemctl start localtube-cifs.service
```

## Troubleshooting CIFS

### Permission Issues
If you get permission errors, ensure the mount options include your user ID:
```bash
-o uid=$(id -u),gid=$(id -g)
```

### Connection Issues
Test the connection first:
```bash
smbclient -L //server -U username
```

### Version Compatibility
Try different SMB versions if connection fails:
- `vers=1.0` - Legacy (Windows XP, old NAS)
- `vers=2.0` - Windows 7
- `vers=2.1` - Windows 7/8
- `vers=3.0` - Windows 8/10 (recommended)
- `vers=3.1.1` - Windows 10 latest

### Performance Tuning
Add these options for better performance:
```bash
-o cache=loose,rsize=1048576,wsize=1048576
```

### Security Options
For better security, use a credentials file instead of plain text:
```bash
-o credentials=/path/to/credentials_file
```

## NAS-Specific Examples

### Synology NAS
```bash
sudo mount -t cifs //nas-ip/video /mnt/videos -o username=admin,password=pass,vers=3.0,uid=$(id -u),gid=$(id -g)
```

### QNAP NAS
```bash
sudo mount -t cifs //nas-ip/Multimedia/Videos /mnt/videos -o username=admin,password=pass,vers=2.1
```

### FreeNAS/TrueNAS
```bash
sudo mount -t cifs //nas-ip/videos /mnt/videos -o username=user,password=pass,vers=3.0,sec=ntlmssp
```

## Notes

- LocalTube will scan the CIFS share on startup, which may take longer than local storage
- Thumbnail generation happens locally, so initial scan might be slow
- Streaming performance depends on your network speed
- Consider using wired ethernet for best performance
- For large libraries, the initial scan and thumbnail generation can take significant time