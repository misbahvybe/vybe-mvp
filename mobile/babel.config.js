module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@api': './src/api',
            '@store': './src/store',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@theme': './src/theme',
            '@components': './src/components',
            '@contexts': './src/contexts',
            '@constants': './src/constants',
            '@lib': './src/lib',
            '@hooks': './src/hooks'
          }
        }
      ]
    ]
  };
};

