function templateString(str, keys)
{
	return str.replace(/\{([a-z]+)\}/g, (raw, cap) => {
		if(keys.hasOwnProperty(cap))
			return keys[cap];
		else
			return raw;
	});
}

function ValidationError(input, errors)
{
	this.name = this.constructor.name;
	this.input = input;
	this.errors = errors.sort((a, b) => a.index - b.index);
}
require("util").inherits(ValidationError, Error);

ValidationError.prototype.errorMessage = function()
{
	var s = [],
		c = "\x1B[31;1m",
		r = "\x1B[0m",
		cursor = 0;
	if(this.errors[0].index === 0)
		s.push(c);
	this.errors.forEach(err => {
		if(err.index > cursor)
		{
			s.push(r);
			s.push(this.input.substr(cursor, err.index - cursor));
		}
		s.push(c);
		s.push(err[0]);
		cursor = err.index + err[0].length;
	});
	if(cursor < this.input.length - 1)
	{
		s.push(r);
		s.push(this.input.substr(cursor));
	}
	else
		s.push(r);
	return s.join("");
}

var MessageTemplates = [
	[(n) => n === 1, "I don't understand {all}."],
	[(n) => n === 1, "Sorry, {last}?"],
	[(n) => n === 3, "{all}..."],
	[(n) => n > 1,   "I don't understand {most} or {last}."],
	[(n) => n > 1,   "Sorry, {most} and {last} don't make sense to me."]
];

ValidationError.prototype.friendlyMessage = function()
{
	var len = this.errors.length,
		templates = MessageTemplates.filter((v, k, a) => {
			return v[0](len);
		}),
		rawErrs = this.errors.map((v, k, a) => { return v[0]; })
	var keys = {
		"most": "'" + rawErrs.slice(0, rawErrs.length - 1).join("', '") + "'",
		"last": "'" + rawErrs[rawErrs.length - 1] + "'",
		"all": "'" + rawErrs.join("', '") + "'"
	};
	return templateString(templates[Math.floor(Math.random() * templates.length)][1], keys);
}
module.exports = ValidationError;

var RawMessages = {
	"StackExceeded": ["Maximum stack size of 5 exceeded", "We're in too deep! Stop stacking sets!"],
	"UnmatchedClose": ["Unmatched ) at index {idx}", "You didn't open a set you closed - be more careful!"],
	"UnmatchedOpen": ["Unmatched ( at index {idx}", "You didn't close a set you opened - be more careful!"],
	"InvalidOpBoth": ["Invalid op: {left}{op}{right}", "You can't do '{left}{op}{right}', ya dongus!"],
	"InvalidOpLeft": ["Invalid op: {left}{op}", "You can't do '{left}{op}', that doesn't make sense!"],
	"InvalidOpRight": ["Invalid op: {op}{right}", "You can't do '{op}{right}', that doesn't make sense!"],
	"InvalidOpNeither": ["Invalid op: blank {op}", "You can't just '{op}' nothing. Why even try?"],
	"TooManyDice": ["Can't roll {count} dice", "Why would you try to roll {count} dice? That's just cruel."]
}

function RawError(input, type, keys)
{
	this.name = this.constructor.name;
	this.input = input;
	this.type = type;
	this.keys = keys;
}
require("util").inherits(RawError, Error);

RawError.prototype.errorMessage = function()
{
	return templateString(RawMessages[this.type][0], this.keys);
}
RawError.prototype.friendlyMessage = function()
{
	return templateString(RawMessages[this.type][1], this.keys);
}

module.exports = {
	"Validation": ValidationError,
	"Typed": RawError
};