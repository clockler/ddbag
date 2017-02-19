function matchGlobal(str, start, config)
{
	if(typeof(start) === "object")
	{
		config = start;
		start = 0;
	}
	var regexen = config.patterns,
		fillGaps = config.fillGaps || false,
		ignoreWhite = config.ignoreWhitespace || true;
	// Single-element array so I don't have to write per-iteration checks
	if(!Array.isArray(regexen))
		regexen = [regexen];
	// Validate that all elements are regular expressions or objects with a tag/regex
	var tagged = regexen[0].constructor.name !== "RegExp";
	regexen.forEach((rxp, idx) => {
		if((rxp.constructor.name === "RegExp") === tagged)
			//TODO: Add actual error information, placing it in strings is bad
			throw new Error("Input #" + idx + " is not a Regular Expression");
	});
	var matchNext = function(start) {
		start = start || 0;
		var lowest = {"index": Number.POSITIVE_INFINITY};
		regexen.forEach(rxp => {
			var r = tagged? rxp.exp : rxp,
				match = str.substr(start).match(r);
			if(match !== null && match.index < lowest.index)
			{
				match.tag = rxp.tag;
				lowest = match;
			}
		});
		if(lowest.index === Number.POSITIVE_INFINITY)
			return null;
		delete lowest.input;
		lowest.index += start;
		return lowest;
	}
	var currentIndex = 0,
		match = matchNext(start || 0),
		matches = [];
	matches.unmatched = [];

	while(match !== null)
	{
		var last = matches.length > 0? matches[matches.length - 1] : {0: "", "index": 0},
			end = last.index + last[0].length;
		if(match.index - end > 0)
		{
			if(fillGaps && tagged)
			{
				var fake = [str.substr(end, match.index - end)];
				if(!(ignoreWhite && fake[0].match(/^\s*$/)))
				{
					fake.index = end;
					fake.tag = "_";
					matches.push(fake);
					matches.unmatched.push(fake);
				}
			}
		}
		matches.push(match);
		match = matchNext(match.index + match[0].length);
	}
	var last = matches.length > 0? matches[matches.length - 1] : {0: "", "index": 0},
		end = last.index + last[0].length;
	if((str.length - 1) - end > 0)
	{
		if(fillGaps && tagged)
		{
			var fake = [str.substr(end, str.length - end)];
			if(!(ignoreWhite && fake[0].match(/^\s*$/)))
			{
				fake.index = end;
				fake.tag = "_";
				matches.push(fake);
			}
		}
	}
	matches.input = str;
	return matches;
}

module.exports = matchGlobal;