import { CommandModule } from 'yargs'
import startServer from '#/helpers/dev/server'

export async function handler (args: any) {
  startServer(args)
}

export default {
  command: 'dev',
  desc: 'Start dev queue server',
  builder: (yargs) => {
    return yargs
      .option('port', {
        alias: 'p',
        describe: 'Port to serve queue',
      })
      .option('retain', {
        describe: 'Retain successful request jobs',
      })
      // .option('memory', {
      //   describe: 'Jobs will be stored in memory only',
      // })
  },
  handler,
} as CommandModule
