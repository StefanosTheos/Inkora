// Vanilla Expo config. NativeWind is NOT wired yet (screens use StyleSheet);
// re-add the nativewind preset + metro withNativeWind when className styling is introduced.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // plugins: ["react-native-reanimated/plugin"], // if reanimated is added
  };
};
