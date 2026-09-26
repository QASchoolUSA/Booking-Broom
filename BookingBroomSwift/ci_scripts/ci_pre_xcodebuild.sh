#!/bin/sh
# Raise CURRENT_PROJECT_VERSION before xcodebuild when Manage Version is OFF.
# When Manage Version is ON, Xcode Cloud still overwrites with CI_BUILD_NUMBER;
# ci_post_xcodebuild.sh patches the archive afterward for that case.
# https://developer.apple.com/documentation/xcode/setting-the-next-build-number-for-xcode-cloud-builds
set -euo pipefail

OFFSET=100
CI_NUM="${CI_BUILD_NUMBER:-0}"
NEXT=$((OFFSET + CI_NUM))

PROJECT_DIR="${CI_PRIMARY_REPOSITORY_PATH}/BookingBroomSwift"
cd "${PROJECT_DIR}"

echo "ci_pre_xcodebuild: setting CURRENT_PROJECT_VERSION to ${NEXT} (offset ${OFFSET} + CI_BUILD_NUMBER ${CI_NUM})"
xcrun agvtool new-version -all "${NEXT}"

# Also stamp Info plists with a literal value so Resolve/archive cannot expand
# an old $(CURRENT_PROJECT_VERSION) if agvtool only touches the pbxproj.
for plist in BookingBroomSwift/Info.plist BookingBroomSwift/Info-macOS.plist; do
  if [ -f "${plist}" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${NEXT}" "${plist}"
    echo "ci_pre_xcodebuild: ${plist} CFBundleVersion=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${plist}")"
  fi
done
