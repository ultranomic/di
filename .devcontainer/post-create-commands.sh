#!/bin/bash
# Install OpenCode CLI
curl -fsSL https://opencode.ai/install | bash

npx oh-my-openagent@latest install --no-tui --claude=no --gemini=no --copilot=no;

# Install RTK CLI & opencode plugin for RTK
# curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
# rtk init -g --opencode;

# Install tmux and set up environment variables for better terminal experience
sudo apt update && sudo apt install tmux -y;
printf "\nexport LANG=C.UTF-8\nexport LC_ALL=C.UTF-8\nexport TERM=xterm-256color\nexport COLORTERM=truecolor\n" >> ~/.bashrc;
