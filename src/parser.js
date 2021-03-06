var Patterns = [
		{"tag": "swroll", "exp": /t\!\(((?:\d*[apbdcs]+)+)\)/i },
		{"tag": "roll", "exp": /(\d+)?d(\d+)([^+-\/\*^%\(\)]+)?/ },
		{"tag": "operand", "exp": /[\+\-\/\*\^\%]/ },
		{"tag": "number", "exp": /\d+(?:\.\d+)?/ }
	],
	SetPatterns = [
		{"tag": "set-open", "exp": /([\!\w]+)?\(/ },
		{"tag": "set-close", "exp": /\)/ }
	],
	Tokenize = require("./tokenize.js"),
	Errors = require("./errors.js"),
	Operators = [
		{"tag": "keep-high", "exp": /kh(\d+)/ },
		{"tag": "keep-low", "exp": /kl(\d+)/ },
		{"tag": "keep-above", "exp": /ka(\d+)/ },
		{"tag": "keep-below", "exp": /kb(\d+)/ },
		{"tag": "sort-asc", "exp": /sa/ },
		{"tag": "sort-sets", "exp": /ss/ },
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
			"sort-desc": (arr) => arr.sort(Sort.Desc),
			"sort-sets": (arr) => {
				var sets = {},
					sorts = [];
				arr.forEach(v => { sets[v] = (sets[v] || 0) + 1 });
				Object.keys(sets).forEach(key => {
					var count = sets[key];
					sorts.push([count, key]);
				});
				sorts = sorts.sort((a, b) => {
					if(a[0] === b[0])
						return b[1] - a[1];
					return b[0] - a[0];
				});
				var res = [];
				sorts.forEach(set => {
					if(set[0] > 1)
						res.push("" + set[0] + "x" + set[1]);
					else
						res.push(String(set[1]));
				});
				return res;
			}
		}
	},
	Macros = {},
	MaxEmbeddednessence = 5,
	Emoji = {
		"Results": {
			// <:g_s:353143885855457291> <:g_a:353143885620445189> <:g_f:353143885930823691> <:g_t:353143885897269256> <:g_sp:353143886081818634> <:g_fp:353143885997801472>
			"s":      "<:g_s:353143885855457291>",
			"a":      "<:g_a:353143885620445189>",
			"T":     "<:g_sp:353143886081818634>",
			"f":      "<:g_f:353143885930823691>",
			"t":      "<:g_t:353143885897269256>",
			"d":     "<:g_fp:353143885997801472>"
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

module.exports = function Parse(str, embeddednessence, max_embeds)
{
	if(typeof(max_embeds) !== "number")
		var max_embeds = MaxEmbeddednessence; // should scope to here

	if(!embeddednessence)
		embeddednessence = 0;
	if(embeddednessence >= max_embeds)
		throw new Errors.Typed(str, "StackExceeded", {});

	var tokens = Tokenize(str, {
		"patterns": SetPatterns,
		"fillGaps": true,
		"ignoreWhitespace": false
	});
	// Parse sets only first
	var sDepth = 0,
		sStart = -1,
		sOp = null,
		newTokens = [],
		ogStr = str,
		errs = [];


	tokens.forEach((token, idx) => {
		if(token.tag === "set-open")
		{
			// Macros?
			if(token[1] && token[1].substr(-1) === "!" && embeddednessence > 0)
			{
				// No macros in the set zone, just throw
				errs.push(token)
			}
			if(sDepth === 0)
			{
				sStart = idx;
			}
			if(token[1] && sOp === null)
				sOp = token[1];
			else
				sOp = "sum";
			sDepth++;
		}
		else if(token.tag === "set-close")
		{
			sDepth--;
			if(sDepth === 0)
			{
				if(sOp && sOp.substr(-1) === "!")
				{
					// Macro, so don't parse, only push the whole set
					newTokens.push(sOp + "(" + tokens.slice(sStart + 1, idx).map((v, k, a) => { return a[k] = v[0]; }).join("") + ")")
				}
				else
				{
					// Parse that inner
					var res = Parse(tokens.slice(sStart + 1, idx).map((v, k, a) => { return a[k] = v[0]; }).join(""), embeddednessence + 1, max_embeds);
					if(Array.isArray(res[0]))
						res = Operands.Set[sOp](res[0]);
					else
						res = res[0];
					newTokens.push(res);
				}
			}
		}
		else if(sDepth === 0)
		{
			newTokens.push(token);
		}
	});
	str = newTokens.join("");
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
	errs = errs.concat(validate(tokens));
	if(errs.length > 0)
	{
		throw new Errors.Validation(str, errs);
	}
	var res = parseTokens(tokens, 0, str);
	if(res[1] === undefined && str !== ogStr)
		res[1] = str;
	return res;
}

function parseTokens(tokens, offset, str)
{
	var override;

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
					var res = parseTokens(tokens.slice(setOpen + 1, idx), cursor, str.substr(0, token.index), embeddednessence + 1)[0];
					// console.log("Parsed set (" + tokens.slice(setOpen + 1, idx).join("") + ")");
					if(Array.isArray(res))
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
				result.s -= result.d;
				result.f -= result.T;
				real_result.d = result.d;
				real_result.T = result.T;

				if(result.s - result.f < 0)
					real_result.f = 0 - (result.s - result.f);
				else
					real_result.s = result.s - result.f;

				if(result.a - result.t < 0)
					real_result.t = 0 - (result.a - result.t);
				else
					real_result.a = result.a - result.t;

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
			return a[k] = {"type": t, "value": v};
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