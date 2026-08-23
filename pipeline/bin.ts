import { main } from './src/cli';

main(process.argv.slice(2)).catch((error: Error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
