#!/bin/sh
# Xcode Cloud overwrites CFBundleVersion with CI_BUILD_NUMBER when the workflow
# has "Manage Version and Build Number" enabled — that is why logs show
# "Build 5" even after raising CURRENT_PROJECT_VERSION in the project.
# Patch the finished .xcarchive so the App Store Connect upload uses a number
# above prior manual / TestFlight uploads.
#
# Preferred long-term: in App Store Connect → Xcode Cloud → workflow → Archive,
# either turn OFF "Manage Version and Build Number", or set Next Build Number
# higher than the last uploaded build.
# https://developer.apple.com/documentation/xcode/setting-the-next-build-number-for-xcode-cloud-builds
set -euo pipefail

OFFSET=100
CI_NUM="${CI_BUILD_NUMBER:-0}"
NEXT=$((OFFSET + CI_NUM))

if [ -z "${CI_ARCHIVE_PATH:-}" ] || [ ! -d "${CI_ARCHIVE_PATH}" ]; then
  echo "ci_post_xcodebuild: CI_ARCHIVE_PATH unset — skipping (not an archive action)"
  exit 0
fi

echo "ci_post_xcodebuild: forcing CFBundleVersion=${NEXT} (offset ${OFFSET} + CI_BUILD_NUMBER ${CI_NUM})"
echo "ci_post_xcodebuild: archive at ${CI_ARCHIVE_PATH}"

ARCHIVE_INFO="${CI_ARCHIVE_PATH}/Info.plist"
if [ -f "${ARCHIVE_INFO}" ]; then
  if /usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" "${ARCHIVE_INFO}" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Set :ApplicationProperties:CFBundleVersion ${NEXT}" "${ARCHIVE_INFO}"
  else
    /usr/libexec/PlistBuddy -c "Add :ApplicationProperties:CFBundleVersion string ${NEXT}" "${ARCHIVE_INFO}"
  fi
  echo "Archive ApplicationProperties:CFBundleVersion=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" "${ARCHIVE_INFO}")"
fi

# Patch every product Info.plist that declares CFBundleVersion (app + extensions).
find "${CI_ARCHIVE_PATH}/Products" -name Info.plist 2>/dev/null | while IFS= read -r plist; do
  if /usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${plist}" >/dev/null 2>&1; then
    before="$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${plist}")"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${NEXT}" "${plist}"
    echo "Patched ${plist}: ${before} -> ${NEXT}"
  fi
done

echo "ci_post_xcodebuild: CFBundleVersion patch complete"
