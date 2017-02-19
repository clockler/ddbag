function matchGlobal(str, regexen, start)
{
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

	while(match !== null)
	{
		matches.push(match);
		match = matchNext(match.index + match[0].length);
	}
	matches.input = str;
	return matches;
}

module.exports = matchGlobal;