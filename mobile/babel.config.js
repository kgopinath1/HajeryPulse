module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@api': './src/api',
          '@auth': './src/auth',
          '@components': './src/components',
          '@navigation': './src/navigation',
          '@screens': './src/screens',
          '@theme': './src/theme',
          '@types': './src/types',
          '@utils': './src/utils',
           '@assets': './src/assets',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
