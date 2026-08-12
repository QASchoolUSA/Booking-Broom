const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const logBoxRoot = path.resolve(projectRoot, "node_modules/@expo/log-box");

const config = getDefaultConfig(projectRoot);

// Monorepo: watch Convex at repo root, prefer mobile's own node_modules first.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Keep hierarchical lookup so pnpm nested deps (e.g. invariant) resolve.
// Pin critical packages so the Next.js workspace React cannot leak in.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@expo/log-box": logBoxRoot,
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  expo: path.resolve(projectRoot, "node_modules/expo"),
  "expo-asset": path.resolve(projectRoot, "node_modules/expo-asset"),
  "expo-constants": path.resolve(projectRoot, "node_modules/expo-constants"),
};

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "@expo/log-box/src/LogBox" ||
    moduleName === "@expo/log-box/src/LogBox.ts"
  ) {
    return {
      type: "sourceFile",
      filePath: path.join(logBoxRoot, "src", "LogBox.ts"),
    };
  }

  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
