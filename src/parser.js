var Patterns = [
		{"tag": "roll", "exp": /(\d+)?d(\d+|F|SW)([^+-\/\*^%\(\)]+)?/ },
		{"tag": "set-open", "exp": /(sum|count)?\(/ },
		{"tag": "set-close", "exp": /\)/ },
		{"tag": "number", "exp": /\d+(?:\.\d+)?/ },
		{"tag": "operand", "exp": /[+-\/\*^%]/ },
		{"tag": "whitespace", "exp": /\s+/ }
	],
	Tokenize = require("./tokenize.js"),
	Operators = [
		{"tag": "keep-high", "exp": /kh(\d+)/ },
		{"tag": "keep-low", "exp": /kl(\d+)/ },
		{"tag": "keep-above", "exp": /(?:ka|tn)(\d+)/ },
		{"tag": "keep-below", "exp": /kb(\d+)/ }
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
			"keep-high": (arr, num) => arr.sort(Sort.Asc).slice(0, num),
			"keep-low": (arr, num) => arr.sort(Sort.Desc).slice(0, num),
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
	return parseTokens(tokens, str, 0);
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
		if(token.index > cursor)
		{
			// Error at the cursor and include everything between the cursor and token
			var e = new Error("Invalid input at index " + cursor + ": '" + str.substr(cursor, token.index - cursor) + "'");
			e.index = cursor;
			e.input = str;
			e.text = str.substr(cursor, token.index - cursor);
			throw e;
		}
		// Second, just log the tag, index and properties
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
					var res = parseTokens(tokens.slice(setOpen + 1, idx), cursor, str, embeddednessence + 1);
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
				//TODO:
				var count = token[1],
					sides = token[2],
					ops = token[3] && token[3].length > 0? Tokenize(token[3], Operators) : [],
					dice = [];
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
				if(!Operands.Set.hasOwnProperty(setOperand))
				{
					var e = new Error("Invalid set operation '" + setOperand + "'");
					e.index = token.index;
					e.text = setOperand;
					e.input = str;
					throw e;
				}
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
	if(cursor < str.length)
	{
		var e = new Error("Invalid input at index " + cursor + ": '" + str.substr(cursor, token.index - cursor) + "'");
		e.index = cursor;
		e.input = str;
		e.text = str.substr(cursor, token.index - cursor);
		throw e;
	}
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