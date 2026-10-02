/** @type {import('prettier').Config} */
const config = {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  semi: true,
  // Keep each file's existing line endings, so a Windows checkout does not
  // report every line of every file as a formatting error.
  endOfLine: 'auto',
};

export default config;
