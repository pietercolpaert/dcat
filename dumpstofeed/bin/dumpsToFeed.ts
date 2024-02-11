const { program } = require('commander');
import {Level} from "level";
import { main } from "../index";

program
  .name('dcat-ap-dumps-to-feed') //TODO: make the DCAT-AP configurable at some point by just being able to point at a shacl shape template configuration but with added target selection
  .description('Translates a dump into a feed')
  .version('0.0.0');

program.argument('<feedname>', 'name of the feed you want to update')
  .argument('<filename>', 'filename of the dump')
  .option('-f, --flush')
  .action(async (feedname: string, filename: string, options: any) => {
    const db = new Level("state-of-" + feedname, { valueEncoding: 'json' })
    if (options.flush) {
        //Check for the flag --reset. If set, flush the db first
        await db.clear();
    }
    main(db, feedname, filename);
  });

program.parse();