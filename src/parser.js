var Patterns = [
		{"tag": "roll", "exp": /(\d+)?d(\d+)([^+-\/\*^%\(\)]+)?/ },
		{"tag": "set-open", "exp": /(sum|count)?\(/ },
		{"tag": "set-close", "exp": /\)/ },
		{"tag": "number", "exp": /\d+(?:\.\d+)?/ },
		{"tag": "operand", "exp": /[+-\/\*^%]/ },
		{"tag": "invalid", "exp": /.+/ } // Will just throw on first instance of invalid input
	],
	Tokenize = require("./tokenize.js"),
	Operators = [
		{"tag": "keep-high", "exp": /kh(\d+)/ },
		{"tag": "keep-low", "exp": /kl(\d+)/ },
		{"tag": "keep-above", "exp": /(?:ka|tn)(\d+)/ },
		{"tag": "keep-below", "exp": /kb(\d+)/ },
		{"tag": "invalid", "exp": /.+/ } // Will just throw on first instance of invalid input
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
			"count": (arr) => arr.length
		},
		"Dice": {
			"keep-high": (arr, num) => arr.sort(Sort.Desc).slice(0, num),
			"keep-low": (arr, num) => arr.sort(Sort.Asc).slice(0, num),
			"keep-above": (arr, num) => {
				arr = arr.sort(Sort.Desc);
				for(var i = 0; i < arr.length; i++)
				{
					if(arr[i] < num)
						return arr.slice(0, i - 1);
				}
			},
			"keep-below": (arr, num) => {
				arr = arr.sort(Sort.Asc);
				for(var i = 0; i < arr.length; i++)
				{
					if(arr[i] >= num)
						return arr.slice(0, i - 1);
				}
			},
		}
	},
	MaxEmbeddednessence = 5;

module.exports = function Parse(str, max_embeds)
{
	if(typeof(max_embeds) === "number")
		var MaxEmbeddednessence = max_embeds; // should scope to here
	var tokens = Tokenize(str, Patterns);
	return parseTokens(tokens, 0, str, 0);
}

function parseTokens(tokens, offset, str, embeddednessence)
{
	if(!embeddednessence)
		embeddednessence = 0;
	if(embeddednessence >= MaxEmbeddednessence)
		throw new Error("We're in too deep! Stop stacking sets!");

	var set = 0,
		setOpen = null,
		setOperand = null,
		cursor = offset,
		tttokens = [];

	tokens.forEach((token, idx) => {
		// First, check that we haven't skipped over anything
		if(token.tag === "invalid")
		{
			// Get error text for helpful debugging!
			var next = Tokenize(str, Patterns.slice(0, Patterns.length - 1), token.index),
				m = "Invalid input at index " + token.index,
				text = "";
			if(next.length > 0)
			{
				text = str.substr(token.index, next[0].index - token.index);
				m = "Invalid input '" + text + "' at index " + token.index;
			}
			else
			{
				text = str.substr(token.index);
				m = "Invalid input '" + text + "' at index " + token.index;
			}
			var e = new Error(m);
			e.input = str;
			e.index = token.index;
			e.text = text;
			throw e;
		}

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
				var count = token[1],
					sides = token[2],
					ops = token[3] && token[3].length > 0? Tokenize(token[3], Operators) : [],
					dice = [];
				if(!count)
					count = 1;
				for(var i = 0; i < count; i++)
				{
					dice.push(Math.ceil(Math.random() * sides));
				}
				ops.forEach(op => { // op
					if(Operands.Dice.hasOwnProperty(op.tag)) // op
					{
						dice = Operands.Dice[op.tag](dice, op[1]); // op op
						// Oppa gangnam style!
					}
					else
					{
						// Get error text for helpful debugging!
						var next = Tokenize(token[3], Operators.slice(0, Operators.length - 1), op.index),
							offset = (token.index + token[1].length + token[2].length + 1),
							m = "Invalid input at index " + (offset + op.index),
							text = "";
						if(next.length > 0)
						{
							text = token[3].substr(op.index, next[0].index - op.index);
							m = "Invalid input '" + text + "' at index " + (offset + op.index);
						}
						else
						{
							text = token[3].substr(op.index);
							m = "Invalid input '" + text + "' at index " + (offset + op.index);
						}
						var e = new Error(m);
						e.input = str;
						e.index = offset + op.index;
						e.text = text;
						throw e;

						// var e = new Error("Invalid input at index " + (token.index + token[1].length + token[2].length + op.index + 1));
						// e.input = str;
						// e.index = (token.index + token[1].length + token[2].length + op.index + 1);
						// throw e;
					}
				});
				tttokens.push(dice);
			}
			else if(token.tag === "number")
			{
				tttokens.push(Number(token[0]));
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
				var e = new Error("Unmatched ) at index " + token.index);
				e.index = token.index;
				e.input = str;
				throw e;
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
			return tttokens[0];
		else
		{
			var e = new Error("Invalid input at index 0: '" + str + "'");
			e.index = 0;
			e.text = str;
			e.input = str;
			throw e;
		}
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
		return res;
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
				if(prev.type !== "number" || next.type !== "number")
				{
					// Check which are invalid
					var m = "Invalid operand '" + tok.value + "'";
					if(prev.type !== "number")
						m += " left side '" + String(prev.value) + "'";
					if(next.type !== "number")
						m += " right side '" + String(next.value) + "'";
					var e = new Error(m);
					e.left = prev.value;
					e.right = prev.value;
					throw e;
				}
				arr = arr.slice(0, i - 1).concat([{"type": "number", "value": Operands.Arithmetic[op](prev.value, next.value)}]).concat(arr.slice(i + 2));
				i--;
			}
		}

	});
	return arr;
}

module.exports.fmtError = function(err)
{
	return err.input.substr(0, err.index) + "\x1B[31;1m" + err.text + "\x1B[0m" + err.input.substr(err.index + err.text.length);
}