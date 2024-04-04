/** I wrote this in like 2017. Not my best work. Functional enough. */

const IOCN_TYPE = "span";
const IOCN_STYLE = {
	'1':	{fontWeight:		"bold"},
	'2':	{fontWeight:		"lighter"},
	'3':	{fontStyle:		"italic"},
	'4':	{textDecoration:	"underline"},
	'7':	{mixBlendMode:		"difference"},
	'21':	{fontWeight:		"normal"},
	'22':	{fontWeight:		"normal"},
	'23':	{fontStyle:		"normal"},
	'24':	{textDecoration:	"none"},
	'27':	{mixBlendMode:		"normal"},
	'30':	{color:			'rgb(1,1,1)'},
	'31':	{color:			'rgb(222,56,43)'},
	'32':	{color:			'rgb(57,181,74)'},
	'33':	{color:			'rgb(255,199,6)'},
	'34':	{color:			'rgb(0,111,184)'},
	'35':	{color:			'rgb(118,38,113)'},
	'36':	{color:			'rgb(44,181,233)'},
	'37':	{color:			'rgb(204,204,204)'},
	'39':	{color:			'inherit'},
	'40':	{backgroundColor:	'rgb(1,1,1)'},
	'41':	{backgroundColor:	'rgb(222,56,43)'},
	'42':	{backgroundColor:	'rgb(57,181,74)'},
	'43':	{backgroundColor:	'rgb(255,199,6)'},
	'44':	{backgroundColor:	'rgb(0,111,184)'},
	'45':	{backgroundColor:	'rgb(118,38,113)'},
	'46':	{backgroundColor:	'rgb(44,181,233)'},
	'47':	{backgroundColor:	'rgb(204,204,204)'},
	'49':	{backgroundColor:	'inherit'},
	'90':	{color:			'rgb(128,128,128)'},
	'91':	{color:			'rgb(255,0,0)'},
	'92':	{color:			'rgb(0,255,0)'},
	'93':	{color:			'rgb(255,255,0)'},
	'94':	{color:			'rgb(0,0,255)'},
	'95':	{color:			'rgb(255,0,255)'},
	'96':	{color:			'rgb(0,255,255)'},
	'97':	{color:			'rgb(255,255,255)'},
	'100':	{backgroundColor:	'rgb(128,128,128)'},
	'101':	{backgroundColor:	'rgb(255,0,0)'},
	'102':	{backgroundColor:	'rgb(0,255,0)'},
	'103':	{backgroundColor:	'rgb(255,255,0)'},
	'104':	{backgroundColor:	'rgb(0,0,255)'},
	'105':	{backgroundColor:	'rgb(255,0,255)'},
	'106':	{backgroundColor:	'rgb(0,255,255)'},
	'107':	{backgroundColor:	'rgb(255,255,255)'},
};

/***
  * IOConsole interface:
  * instantiate with `new IOConsole(caller, outnode[, container])`
  * outnode is the node where the magic happens
  * container is the object click to get focus of the console
	* defaults to outnode
  * caller is an object with attributes:
	* .console(cons): console object is passed here on initialization
	* .call(line): callback with the next line
  * the console has output functions print() and println(), pass UTF-8 strings please
***/

class CHistory {
	constructor(max) {
		this.ohistory = [];
		this.history = [''];
		this.pos = 0;
		this.max = max;
	}
	up(old) {
		if (this.pos == 0) {
			return old;
		}
		this.history[this.pos--] = old;
		return this.history[this.pos];
	}
	down(old) {
		if (this.pos >= this.history.length - 1) {
			return old;
		}
		this.history[this.pos++] = old;
		return this.history[this.pos];
	}
	commit(cmd) {
		if (!cmd.match(/^\s/) && cmd !== this.ohistory[this.ohistory.length - 1]) {
			this.ohistory.push(cmd);
			if (this.ohistory.length > this.max) {
				this.ohistory.shift();
			}
			this.history = Array.from(this.ohistory);
			this.history.push("");
		}
		this.pos = this.ohistory.length;
	}
}

class IOConsole {
	constructor(caller, outnode, container) {
		if (!outnode) {
			throw "Invalid outnode!";
		}
		this.caller = caller;
		this.container = container || outnode;
		
		this.input = document.createElement(IOCN_TYPE);
		this.input.contentEditable = "true";
		this.input.autofocus = true;
		this.input.focus();
		
		this.outputter = new Outputter(outnode, this.input);
		
		this.history = new CHistory(1000);
		
		window.addEventListener('keydown', ev => {
			this.onkey(ev);
		});
		window.addEventListener('click', ev => {
			if (this.container.contains(ev.target)) {
				this.input.focus();
			}
		});
	}
	onkey(ev) {
		if (!this.container.contains(ev.target)) {
			return false;
		}
		this.input.focus();
		const text = this.input.innerText;
		
		switch(ev.key) {
		case "d":
			if (ev.ctrlKey) {
				ev.preventDefault();
				if (!this.input.innerText.length) {
					this.caller(null);
				}
			}
			break;
		case "Enter":
			this.outputter.println(text);
			this.history.commit(text);
			this.caller(text);
			this.input.focus();
			this.input.innerHTML = "";
		case "Tab":
			ev.preventDefault();
			break;
		case "ArrowDown":
			this.input.innerText = this.history.down(text);
			break;
		case "ArrowUp":
			this.input.innerText = this.history.up(text);
			break;
		default:
			//console.log(ev.code);
		}
		return false;
	}
}

class Outputter {
	constructor(outn, input) {
		this.outnode = outn;
		this.input = input;
		this._chfn();
	}

	print(str) {
		if (!str) {
			return;
		}
		const clear = str.split("\x0c");
		if (clear.length > 1) {
			while (this.outnode.firstChild) {
				this.outnode.removeChild(this.outnode.firstChild);
			}
			this._chfn();
			str = clear[clear.length - 1];
		}
		const fmtsec = str.split(/(?=\x1b\[[0-9;]+m)/);
		//console.log(fmtsec);
		for (let i = 0; i < fmtsec.length; i++) {
			let pos = 0, fmt = null;
			fmtsec[i].replace(/^\x1b\[([0-9;]+)m/, (match, one) => {
				pos = match.length;
				fmt = one.split(";");
			});
			if (fmt) {
				//console.log('formatting');
				this.format(fmt);
			}
			const word = fmtsec[i].substring(pos);
			if (word) {
				this.fnode.insertBefore(document.createTextNode(word), this.input);
			}
		}
		this.outnode.scrollTo(0, this.outnode.scrollHeight);
	}
	println(str) {
		this.print((str || "") + '\n');
	}
	_chfn() {
		this.fnode = document.createElement(IOCN_TYPE);
		this.outnode.appendChild(this.fnode);
		this.fnode.appendChild(this.input);
	}

	_objcp(dest, src) {
		if (!src || !dest) {
			return;
		}
		for (const i in src) {
			dest[i] = src[i];
		}
	}
	format(nums) {
		if (!nums) return;
		this._chfn();
		for (let i = 0; i < nums.length; i++) {
			if (nums[i] === "0") {
				this.fnode.style = "";
			} else {
				this._objcp(this.fnode.style, IOCN_STYLE[nums[i]]);
			}
		}
	}
	clrfmt() {
		this.format(["0"]);
	}
}
