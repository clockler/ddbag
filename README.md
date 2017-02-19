# ddbag

First second version of an older bot. Warning: Bad code ahead.

# Usage

Want it in your server? [Just use this link](https://discordapp.com/api/oauth2/authorize?client_id=282751290029899776&scope=bot&permissions=67488832) to add it. Only the Read Messages and Send Messages permissions are currently used, the others are just there in case I feel like using them later for any reason. None of these require 2FA or are administrative in nature.

Note that I don't currently implement sharding at all. It's on the cards, but will require a more abstracted gateway approach.

See it in your server? Just mention it and go nuts - the main version of this is running as `@dbag#7193`. Any message mentioning the bot is logged, even if it's 100% erroneous, so feel free to put suggestions to me that way if you got 'em. I promise to check the logs if it crashes. You should try to make it do that, too.

## Rolling Dice

Use `{count}d{sides}{mutations}` for rolling dice, such as `11d10` (note that results, if output as a list, are sorted in descending order). The following mutations are supported:

* `kh{count}` Keep the highest `count` dice of the roll: `2d20kh1`
* `kl{count}` Keep the lowest `count` dice of the roll: `2d20kl1`
* `ka{target}` Keep all dice which rolled greater than or equal to `target`: `11d10ka7`
* `kb{target}` Keep all dice which rolled below `target`: `11d10kb7`

## Arithmetic

Raw numbers and dice rolls can intermingle with arithmetic operators, which will be evaluated using in the below order. Note that performing arithmetic on any dice result will sum it automatically, and never apply changes to each die.

* `^` Exponential
* `*` Multiplication
* `/` Division
* `+` Addition
* `-` Subtraction
* `%` Modulus (why not?)

## Parentheses

Parentheses can stack your inputs, exactly as you'd expect. Prefixes can also modify how the parentheses resolve - the following are supported:

* `sum({input})` Sum up all dice in the resulting array. Implicit - if you do anything other than finalize a roll with a set of dice, it will be summed.
* `count({input})` Return the count of dice rolled. Useful for successes, as in `count(12d6ka5)` to count dice rolling 5 or 6. Of course, doing this manually is probably desirable in most systems, since other results may be important.


# Run your own!

Create an application and put its bot token in the same directory as `main.js`, in a file named only `token` and with no whitespace. Then simply invoke the name of the demon which is nodeJS upon it, and it should run. It might not. Who can really know?