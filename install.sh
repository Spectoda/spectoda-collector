#!/bin/bash

# Check if the -y flag is passed as an argument
if [[ "$1" == "-y" ]]; then
  AUTO_YES=true
fi

# Check if running under root
if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# Function to handle prompts
prompt() {
  if [[ ! $AUTO_YES ]]; then
    read -p "$1 (y/n) " -n 1 -r
    echo
  fi
  [[ $AUTO_YES || $REPLY =~ ^[Yy]$ ]]
}

# Ask user if they want to update the repo
if prompt "Do you want to update the repo?"; then
  git pull
  git submodule update --init --recursive
  chown -R gateway:gateway .
fi

# Ask user if they want to build the project first
if prompt "Do you want to build the project first?"; then
  sleep 1
  su gateway -c 'npm i'
  su gateway -c './build.sh'
fi

echo "Installing systemd service and enabling it..."
sleep 1

# Create the systemd service file
cat <<EOF > /etc/systemd/system/spectoda-collector.service
[Unit]
Description=Bridge for connecting to Spectoda Ecosystem
After=network.target

[Service]
User=gateway
Group=gateway
WorkingDirectory=/home/gateway/spectoda-collector/build/
ExecStart=/bin/bash -i -c 'DEBUG=* node src/main.js'
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF

if [ -f /etc/systemd/system/spectoda-collector.service ]; then
  systemctl disable --now spectoda-collector.service
fi

# do you want to copy the default.db to build/sqlite.db?
if prompt "Do you want to copy the default.db to build/sqlite.db?"; then
  sleep 3
  cp ./default.db build/sqlite.db
  echo "Copied default.db to build/sqlite.db"
fi

chown -R gateway:gateway .

# Reload systemd daemon to pick up the new service file
systemctl daemon-reload

# Enable and start the service
systemctl enable --now spectoda-collector.service


### Set auto restart Shellhub
LINE="*/15 * * * * docker container restart shellhub-spectoda"

# Check if the crontab line already exists
(crontab -l | grep -Fq "$LINE") || (crontab -l; echo "$LINE") | crontab -