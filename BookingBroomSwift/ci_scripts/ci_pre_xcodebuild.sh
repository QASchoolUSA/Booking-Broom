#!/bin/sh
# Xcode Cloud: keep CFBundleVersion above prior App Store Connect uploads.
# Manual archives / TestFlight builds (outside Xcode Cloud) already used numbers
# in the teens+, so CI_BUILD_NUMBER alone can still lose. Offset clears that gap.
# See: https://developer.apple.com/documentation/xcode/setting-the-next-build-number-for-xcode-cloud-builds
set -euo pipefail

OFFSET=100
CI_NUM="${CI_BUILD_NUMBER:-0}"
NEXT=$((OFFSET + CI_NUM))

PROJECT_DIR="${CI_PRIMARY_REPOSITORY_PATH}/BookingBroomSwift"
cd "${PROJECT_DIR}"

echo "ci_pre_xcodebuild: setting CURRENT_PROJECT_VERSION to ${NEXT} (offset ${OFFSET} + CI_BUILD_NUMBER ${CI_NUM})"
xcrun agvtool new-version -all "${NEXT}"
