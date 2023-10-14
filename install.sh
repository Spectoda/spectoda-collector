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
  chown -R gateway:gateway .
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
WorkingDirectory=/home/gateway/spectoda-collector/
ExecStart=/bin/bash -i -c 'DEBUG=* npm start'
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF

if [ -f /etc/systemd/system/spectoda-collector.service ]; then
  systemctl disable --now spectoda-collector.service
fi

# # do you want to copy the default.db to build/sqlite.db?
# if prompt "Do you want to copy the default.db to build/sqlite.db?"; then
#   sleep 3
#   cp ./default.db build/sqlite.db
#   echo "Copied default.db to build/sqlite.db"
# fi

chown -R gateway:gateway .

# Reload systemd daemon to pick up the new service file
systemctl daemon-reload

# Enable and start the service
systemctl enable --now spectoda-collector.service

# remove existing LINE_RESTART
crontab -l | grep -v 'docker container restart shellhub-spectoda' > /tmp/cron.tmp

# Set auto restart Shellhub
LINE_RESTART="*/30 * * * * docker container restart shellhub-spectoda"


# Check if the Shellhub restart crontab line already exists
(crontab -l | grep -Fq "$LINE_RESTART") || (crontab -l; echo "$LINE_RESTART") | crontab -

# LINE_REBOOT="0 0 * * * /sbin/reboot"

# # Check if the reboot crontab line already exists
# (crontab -l | grep -Fq "$LINE_REBOOT") || (crontab -l; echo "$LINE_REBOOT") | crontab -

LINE_REBOOT="0 0 * * 5 /sbin/reboot"

# Remove the existing midnight reboot line if it exists
crontab -l | grep -v '/sbin/reboot' > /tmp/cron.tmp

# Add the new line to the temporary file
echo "$LINE_REBOOT" >> /tmp/cron.tmp

# Update crontab from the temporary file
crontab /tmp/cron.tmp

# Remove the temporary file
rm /tmp/cron.tmp
