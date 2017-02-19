var logPrio = Number(process.env["LOG"]),
	lastCat = -1, blankPad, subPad;
if(isNaN(logPrio))
	logPrio = false;
function Log() {
	var cat = types[types._list[arguments[arguments.length - 1].idx]];
	if(logPrio === false || logPrio >= cat.priority)
	{
		var str = arguments[0],
			a = arguments;
		if(typeof(str) === "object" && str.toString() === "[object Arguments]")
		{
			a = a[0];
			str = a[0];
		}
		for(var i = 1; i < arguments.length - 1; i++)
		{
			str = str + " " + arguments[i];
		}
		var tokens = String(str).split("\n");
		if(tokens.length > 1)
			for(var i = 1; i < tokens.length; i++)
			{
				tokens[i] = subPad + tokens[i].trim();
			}
		str = tokens.join("\n");
		var pfx = lastCat === cat.idx? blankPad : "\x1B[" + cat.color + "m" + cat.pfx + "\x1B[0m ";
		console.log(pfx + str);
		lastCat = cat.idx;
	}
}

var types = {
	"_list": [],
	"Error": {
		"color": "31;1",
		"priority": 0
	},
	"Network": {
		"color": "33;1",
		"priority": 1
	},
	"Debug": {
		"color": "32",
		"priority": 2
	},
	"Status": {
		"color": "30;1",
		"priority": 2
	}
};

function atoa(obj)
{
	var a = [];
	for(var i = 0; i < obj.length; i++)
	{
		a.push(obj[i]);
	}
	return a;
}
function pad(len)
{
	var s = "";
	for(var i = 0; i < len; i++)
		s = s + " ";
	return s;
}
var l = 0;
for(var k in types)
{
	if(k[0] !== "_" && types.hasOwnProperty(k))
	{
		if(k.length > l)
			l = k.length;
		types._list.push(k);
		var fn = function() { var a = atoa(arguments); a.push(this); Log.apply(Log, a); };
		fn.idx = types._list.length - 1;
		Log[k] = fn.bind(fn);
		Log[k].idx = fn.idx;
		types[k].idx = fn.idx;
	}
}
for(var i = 0; i < types._list.length; i++)
{
	types[types._list[i]].pfx = pad((l - types._list[i].length) + 1) + types._list[i];
}
blankPad = pad(l + 2);
subPad = pad(l);

Log.ErrorHandler = e => {
	if(e && typeof(e) === "object" && e.stack)
		Log.Error(e.stack);
	else
		Log.Error(e);
};

module.exports = Log;