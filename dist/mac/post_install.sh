#!/bin/sh

VERSION='0.8.6'
INSTALL_PATH="/usr/lib/prey/versions/${VERSION}"

# say $(whoami)
${INSTALL_PATH}/bin/prey config activate --gui
