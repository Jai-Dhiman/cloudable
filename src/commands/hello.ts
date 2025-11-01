import {Args, Command, Flags} from '@oclif/core'

export default class Hello extends Command {
  static args = {
    name: Args.string({description: 'Name to greet', required: false}),
  }

  static description = 'Say hello'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> world',
    '<%= config.bin %> <%= command.id %> --name=World',
  ]

  static flags = {
    name: Flags.string({char: 'n', description: 'Name to greet'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Hello)

    const name = flags.name ?? args.name ?? 'World'
    this.log(`Hello ${name}!`)
  }
}
