var Patterns = [
		{"tag": "swroll", "exp": /t\!\(((?:\d*[apbdcs]+)+)\)/i },
		{"tag": "roll", "exp": /(\d+)?d(\d+)([^+-\/\*^%\(\)]+)?/ },
		{"tag": "set-open", "exp": /(sum|count|group)?\(/ },
		{"tag": "set-close", "exp": /\)/ },
		{"tag": "operand", "exp": /[\+\-\/\*\^\%]/ },
		{"tag": "number", "exp": /\d+(?:\.\d+)?/ }
	],
	Tokenize = require("./tokenize.js"),
	Errors = require("./errors.js"),
	Operators = [
		{"tag": "keep-high", "exp": /kh(\d+)/ },
		{"tag": "keep-low", "exp": /kl(\d+)/ },
		{"tag": "keep-above", "exp": /ka(\d+)/ },
		{"tag": "keep-below", "exp": /kb(\d+)/ },
		{"tag": "sort-asc", "exp": /sa/ },
		{"tag": "sort-desc", "exp": /sd?/ }
	],
	Sort = {
		"Asc": (a, b) => a - b,
		"Desc": (a, b) => b - a
	},
	Operands = {
		"Arithmetic": {
			"+": (a, b) => a + b,
			"-": (a, b) => a - b,
			"/": (a, b) => a / b,
			"*": (a, b) => a * b,
			"^": (a, b) => Math.pow(a, b),
			"%": (a, b) => a % b
		},
		"Set": {
			"sum": (arr) => {
				var s = 0;
				arr.forEach(a => {
					s += Number(a);
				});
				return s;
			},
			"count": (arr) => arr.length,
			"group": (arr) => {
				var g = {},
					r = [];
				arr.forEach(n => { g[n] = (g[n] || 0) + 1; });
				Object.keys(g).forEach(n => {
					r.push((g[n] > 1? g[n] + "x" : "") + n);
				});
				return r.sort((a, b) => Number((b.match(/^(\d+)x/) || [0, 1])[1]) - Number((a.match(/^(\d+)x/) || [0, 1])[1]));
			}
		},
		"Dice": {
			"keep-high": (arr, num) => arr.sort(Sort.Desc).slice(0, num),
			"keep-low": (arr, num) => arr.sort(Sort.Asc).slice(0, num),
			"keep-above": (arr, num) => arr.filter(n => n >= num),
			"keep-below": (arr, num) => arr.filter(n => n < num),
			"sort-asc": (arr) => arr.sort(Sort.Asc),
			"sort-desc": (arr) => arr.sort(Sort.Desc)
		}
	},
	Macros = {},
	MaxEmbeddednessence = 5,
	Emoji = {
		"Results": {
			"s":     "<:swrsuccess:230983326473650176>",
			"a":   "<:swradvantage:230982225464786944>",
			"T":     "<:swrtriumph:230982301318774784>",
			"f":     "<:swrfailure:230982263267917824>",
			"t":      "<:swrthreat:230983337529966592>",
			"d":     "<:swrdespair:230982249007415296>"
		},
		"Dice": {
			"a":     "<:swdability:315020911243952128>",
			"p": "<:swdproficiency:230982272088670208>",
			"b":       "<:swdboost:230982234314637312>",
			"d":  "<:swddifficulty:230982256192258048>",
			"c":   "<:swdchallenge:230982241872773120>",
			"s":     "<:swdsetback:230982279214792705>"
		}
	},
	SWDice = {
		"a": ["", "s", "s", "ss", "a", "a", "as", "aa"],
		"p": ["", "s", "s", "ss", "ss", "a", "sa", "sa", "sa", "aa", "aa", "T"],
		"b": ["", "", "s", "sa", "aa", "a"],
		"d": ["", "f", "ff", "t", "t", "t", "tt", "ft"],
		"c": ["", "f", "f", "ff", "ff", "t", "t", "ft", "ft", "tt", "tt", "d"],
		"s": ["", "", "f", "f", "t", "t"]
	};

module.exports = function Parse(str, max_embeds)
{
	if(typeof(max_embeds) === "number")
		var MaxEmbeddednessence = max_embeds; // should scope to here
	var tokens = Tokenize(str, {
		"patterns": Patterns,
		"fillGaps": true,
		"ignoreWhitespace": true
	});
	// Validate now
	// Ugh, a kludge
	if(tokens[0].tag === "operand")
	{
		if(tokens[0][0] === "-" || tokens[0][0] === "+")
		{
			var fake = ["0"];
			fake.index = -1;
			fake.tag = "number";
			tokens.unshift(fake);
		}
	}
	var errs = validate(tokens);
	if(errs.length > 0)
	{
		throw new Errors.Validation(str, errs);
	}
	return parseTokens(tokens, 0, str, 0);
}

function parseTokens(tokens, offset, str, embeddednessence)
{
	var override;
	if(!embeddednessence)
		embeddednessence = 0;
	if(embeddednessence >= MaxEmbeddednessence)
		throw new Errors.Typed(str, "StackExceeded", {});

	var set = 0,
		setOpen = null,
		setOperand = null,
		cursor = offset,
		tttokens = [];

	tokens.forEach((token, idx) => {

		if(set > 0)
		{
			// We have an open set - ignore everything except set-open and set-close
			if(token.tag === "set-open")
			{
				set++;
			}
			else if(token.tag === "set-close")
			{
				set--;
				if(set <= 0)
				{
					// Just in case
					set = 0;
					// Xu Li: Do the thing!
					var res = parseTokens(tokens.slice(setOpen + 1, idx), cursor, str.substr(0, token.index), embeddednessence + 1);
					res = Operands.Set[setOperand](res);
					tttokens.push(res);
				}
			}
		}
		else
		{
			if(token.tag === "roll")
			{
				// THE BIG ONE
				token[1] = token[1] || ""; // Empty string here for string indexing in errors (if applicable)
				var count = token[1].replace(/\,/g, ""),
					sides = token[2],
					ops = token[3] && token[3].length > 0? Tokenize(token[3], {
						"patterns": Operators,
						"fillGaps": true,
						"ignoreWhitespace": true
					}) : [],
					offset = (token.index + token[1].length + token[2].length + 1),
					dice = [];

				if(!count)
					count = 1;
				if(count > 99)
				{
					throw new Errors.Typed(str, "TooManyDice", {"count": count});
				}
				if(sides <= 0)
				{
					throw new Errors.Typed(str, "WeirdDice", {"sides": sides});
				}
				for(var i = 0; i < count; i++)
				{
					dice.push(Math.ceil(Math.random() * sides));
				}
				// dice = dice.sort(Sort.Desc);
				ops.forEach(op => { // op
					if(Operands.Dice.hasOwnProperty(op.tag)) // op
					{
						dice = Operands.Dice[op.tag](dice, op[1]); // op op
						// Oppa gangnam style!
					}
				});
				tttokens.push(dice);
			}
			else if(token.tag === "swroll")
			{
				var r = token[1].match(/\d*[apbdcs]/gi),
					pool = {
						"a": 0,
						"p": 0,
						"b": 0,
						"d": 0,
						"c": 0,
						"s": 0
					};
				r.forEach(d => {
					var m = d.match(/(\d*?)([apbdcs])/i),
						n = Number(m[1] || 1),
						d = m[2];
					if(pool.hasOwnProperty(d))
					{
						pool[d] += n;
					}
				});
				var os = [];
				var result = {
					"s": 0,
					"f": 0,
					"a": 0,
					"t": 0,
					"T": 0,
					"d": 0
				};
				var count = (arr) => {
					var ks = {};
					arr.forEach(el => ks[el]++);
					return ks;
				};
					
				Object.keys(pool).forEach(die => {
					os.push(Array(pool[die]).fill(Emoji.Dice[die]).join(""));
					for(var i = 0; i < pool[die]; i++)
					{
						var els = count(SWDice[die][Math.floor(Math.random() * SWDice[die].length)].split(""));
						Object.keys(els).forEach(el => result[el]++);
					}
				});
				override = os.join("");
				var s = [];
				// Reduce success/failure
				var real_result = {"s": 0, "f": 0, "a": 0, "t": 0, "T": 0, "d": 0};
				if(result.s - result.f < 0)
					real_result.f = 0 - (result.s - result.f);
				else
					real_result.s = result.s - result.f;

				if(result.a - result.t < 0)
					real_result.t = 0 - (result.a - result.t);
				else
					real_result.a = result.a - result.t;
				
				if(result.T - result.d < 0)
					real_result.d = 0 - (result.T - result.d);
				else
					real_result.T = result.T - result.d;

				result = real_result;

				Object.keys(result).forEach(r => {
					s.push(Array(result[r]).fill(Emoji.Results[r]).join(""));
				});
				tttokens.push([s.join("")]);
			}
			else if(token.tag === "number")
			{
				tttokens.push(Number(token[0].replace(/\,/g, "")));
			}
			else if(token.tag === "set-open")
			{
				// This actually can have a word in front which is used to manipulate that set afterwards
				// Implicit, this manipulation is 'sum', but 'count' is also valid
				// When we encounter a set-open tag we just ignore everything until we hit its set-close,
				// then pass that on to a sub-parser for nesting
				set++;
				setOpen = idx;
				setOperand = !token[1]? "sum" : token[1];
			}
			else if(token.tag === "set-close")
			{
				// Error because this means we hit a set-close outside a set
				throw new Errors.Typed(str, "UnmatchedClose", {"idx": token.index});
			}
			else if(token.tag === "operand")
			{
				tttokens.push(token[0]);
			}
		}
		cursor = token.index + token[0].length;
	});
	// Resolve everything
	if(tttokens.length === 1)
	{
		// OKAY
		var t = Array.isArray(tttokens[0])? "array" : typeof(tttokens[0]);
		if(t === "array" || t === "number")
			return [tttokens[0], override];
	}
	else
	{
		tttokens.map((v, k, a) => {
			var t = Array.isArray(v)? "array" : typeof(v);
			if(t === "array")
			{
				// IMPLICIT SUMS AHOY
				v = Operands.Set.sum(v);
				t = "number";
			}
			return [a[k] = {"type": t, "value": v}, override];
		});
		var res = reduceResult(tttokens);
		res.map((v, k, a) => a[k] = v.value);
		return [res, override];
	}
}

function reduceResult(arr)
{
	var order = ["^", "*", "/", "+", "-", "%"];
	order.forEach(op => {

		for(var i = 0; i < arr.length; i++)
		{
			var tok = arr[i];
			if(tok.type === "string" && tok.value === op)
			{
				var prev = arr[i - 1],
					next = arr[i + 1];
				if((!prev || prev.type !== "number") || (!next || next.type !== "number"))
				{
					// Check which are invalid
					var keys = {"op": tok.value},
						type = "InvalidOpNeither";
					if(prev && prev.type !== "number")
					{
						keys.left = String(prev.value);
						type = "InvalidOpLeft";
					}
					if(next && next.type !== "number")
					{
						keys.right = String(next.value);
						type = type === "InvalidOpLeft"? "InvalidOpBoth" : "InvalidOpRight";
					}
					throw new Errors.Typed("", type, keys);
				}
				arr = arr.slice(0, i - 1).concat([{"type": "number", "value": Operands.Arithmetic[op](prev.value, next.value)}]).concat(arr.slice(i + 2));
				i--;
			}
		}

	});
	return arr;
}

function validate(tokens)
{
	//TODO: Setup system whereby invalid input is ignored if it is adjacent to non-operand tags only, and has whitespace on sides it is adjacent to tags
	var errs = [];
	tokens.forEach((tok, idx) => {
		if(tok.tag === "_")
		{
			errs.push(tok);
		}
		else if(tok.tag === "roll")
		{
			// Validate roll mutations
			if(tok[3] && tok[3].length > 0)
			{
				var muts = Tokenize(tok[3], {
					"patterns": Operators,
					"fillGaps": true,
					"ignoreWhitespace": false
				});
				muts.forEach(mut => {
					if(mut.tag === "_")
					{
						var offset = (tok.index + tok[1].length + tok[2].length + 1);
						mut.index += offset;
						errs.push(mut);
					}
				});
			}
		}
		else if(tok.tag === "operand")
		{
			// First or last is invalid.
			if(idx === 0 || idx === tokens.length - 1)
			{
				tok.tag = "_";
				errs.push(tok);
			}
		}
	});
	return errs;
}