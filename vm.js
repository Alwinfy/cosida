/**
 * This is Spindle - a somewhat bespoke virtual machine.
 * makeFunc() is the compiler layer, and execs() runs functions.
 *
 * All instructions have mnemonics that are single characters,
 * though some instructions are namespaced and some are suffixed
 * with jump labels or indices.
 *
 * The machine's primary features ape the JVM, with a similar calling
 * convention and memory layout (fixed number of registers, with an
 * operand stack that opcodes operate on). Number operations are namespaced
 * under the 'a' prefix; list operations under 'l'; character ops under 'c'.
 *
 * Notably, Spindle has first-class iterators and coroutines (hence
 * the name); it provides the 'N' (next) opcode for advancing them,
 * and the 'K' (create coroutine) and 'Y' (yield) opcodes for coroutine-
 * style iteration and control flow.
 *
 * Spindle's primary mode of communication with the outside world is through
 * the globals parameter on execs(); arbitrary JS objects may be placed there
 * and referenced through the 'R' (read) opcode. Functions may be called (though
 * only single-argument functions; write an => shim for others) with the '@'
 * (apply) opcode.
 */

/** Opcode implementations follow... */
const mem_insns = {
	// load from arg/local
	'L': i => (stack, state) => stack.push(state.locals[i]),
	// load from constant table
	'R': i => (stack, state) => stack.push(state.globals[i]),
	// store to arg/local
	'S': i => (stack, state) => state.locals[i] = stack.pop(),
	// call subroutine
	'C': i => (stack, state) => state.perform_call(i),
	// pack top N items into list
	'P': len => stack => stack.push(stack.splice(stack.length - len, len)),
	// instantiate coroutine
	'K': i => (stack, state) => stack.push(state.make_coro(i)),
};

const truthy = v => v || v === "" || v instanceof Array;

const branch_insns = {
	// unconditional branch
	'J': p => (_, state) => state.branch(p),
	// branch if leq 0
	'<': p => (stack, state) => stack.pop() < 0 && state.branch(p),
	// branch if !=0 (truthy)
	'B': p => (stack, state) => truthy(stack.pop()) && state.branch(p),
	// branch if =0 (falsey)
	'Z': p => (stack, state) => truthy(stack.pop()) || state.branch(p),
	// advance iterator; branch if empty
	'N': p => (stack, state) => {
		const it = stack.pop();
		if (it.is_coro) {
			it.enter_coro(p);
			return;
		}
		const step = it.next();
		if (step.done) {
			state.branch(p);
		} else {
			stack.push(step.value);
		}
	},
};
const ez_insns = {
	// yield from coroutine
	'Y': (stack, state) => state.do_yield(stack.pop()),
	// indirect jump
	'I': (stack, state) => state.perform_call(stack.pop().call_label),
	// dup top-of-stack
	'd': stack => stack.push(stack[stack.length - 1]),
	// pop stack
	'p': stack => stack.pop(),
	// swap top 2 of stack
	's': stack => stack.push(stack.splice(stack.length - 2, 1)[0]),
	// call function pointer (syscall)
	'@': stack => stack.pop()(stack.pop()),
	// sleep for N milliseconds
	'z': stack => new Promise(res => setTimeout(res, stack.pop())),
	// unpack list onto stack
	'U': stack => stack.push(...stack.pop()),
	// read 1 byte from given memory block+offset
	'3': stack => stack.push(new DataView(stack.pop()).getUint8(stack.pop())),
	// read 4 bytes from given memory block+offset
	'5': stack => stack.push(new DataView(stack.pop()).getUint32(stack.pop())),
};

const ls_insns = {
	// create empty list
	'e': stack => stack.push([]),
	// access nth element of sequence
	'r': stack => stack.push(stack.pop()[stack.pop()]),
	// set nth element of sequence
	's': stack => stack.pop()[stack.pop()] = stack.pop(),
	// push to list
	'p': stack => stack.pop().push(stack.pop()),
	// convert iterable to iterator
	'i': stack => stack.push(stack.pop()[Symbol.iterator]()),
	// take length of sequence
	'l': stack => stack.push(stack.pop().length),
};
const char_insns = {
	// empty string
	'e': stack => stack.push(""),
	// char -> int
	'o': stack => stack.push(stack.pop().charCodeAt(0)),
	// int -> char
	'c': stack => stack.push(String.fromCharCode(stack.pop())),
	// join list of chars into string
	'j': stack => stack.push(stack.pop().join("")),
	// join list into string, with intercalating character
	'J': stack => stack.push(stack.pop().join(stack.pop())),
};

const arith_insns = {
	// you know what all these do.
	'+': stack => stack.push(stack.pop() + stack.pop()),
	'-': stack => stack.push(stack.pop() - stack.pop()),
	'=': stack => stack.push(stack.pop() === stack.pop()),
	'*': stack => stack.push(stack.pop() * stack.pop()),
	'/': stack => stack.push(stack.pop() / stack.pop()),
	'%': stack => stack.push(stack.pop() % stack.pop()),
	'<': stack => stack.push(stack.pop() << stack.pop()),
	'>': stack => stack.push(stack.pop() >> stack.pop()),
	'~': stack => stack.push(~stack.pop()),
	'!': stack => stack.push(!stack.pop()),
	'|': stack => stack.push(stack.pop() | stack.pop()),
	'&': stack => stack.push(stack.pop() & stack.pop()),
	'^': stack => stack.push(stack.pop() ^ stack.pop()),
	'P': stack => stack.push(Math.pow(stack.pop(), stack.pop())),
	// number -> BigInt
	'N': stack => stack.push(BigInt(stack.pop())),
	// random number [0..n)
	'R': stack => stack.push(0 | (stack.pop() * Math.random())),
};
/** ...end opcode implementations. */

/** This is the assembler - decodes a string into a sequence of functions. */
function decode(string, scnt) {
	let ptr = 0;
	const bmap = {};
	const insns = [];
	const lbls = [];
	while (ptr < string.length) {
		const ch = string[ptr++];
		switch (ch) {
			case ' ': case '\t': case '\n': break;
			case '#': bmap[string[ptr++]] = insns.length; break;
			case '&': {
				const func_name = string[ptr++];
				const funcbox = {call_label: func_name};
				insns.push(stack => stack.push(funcbox));
			}
			case 'L': case 'S': {
				const schr = string[ptr++];
				const slot = +schr;
				if (!(slot < scnt)) {
					throw new Error("Slot size exceeded in bytecode: " + schr);
				}
				insns.push(mem_insns[ch](slot));
				break;
			}
			case '\\': {
				const ch = string[ptr++];
				insns.push(stack => stack.push(ch));
				break;
			}
			case 'P': case 'R': case 'C': case 'K':
				insns.push(mem_insns[ch](string[ptr++])); break;
			case 'J': case '<': case 'B': case 'N': case 'Z': {
				const lbl = string[ptr++];
				lbls.push(lbl);
				insns.push(branch_insns[ch](lbl));
				break;
			}
			case 'I': case 'Y': case '3': case '5': case 'U':
			case '@': case 'p': case 'd': case 's': case 'z':
				insns.push(ez_insns[ch]); break;
			case 'l': insns.push(ls_insns[string[ptr++]]); break;
			case 'c': insns.push(char_insns[string[ptr++]]); break;
			case 'a': insns.push(arith_insns[string[ptr++]]); break;
			case '0': {
				const pos = ptr;
				while (ptr < string.length && string[ptr] != '$') ptr++;
				const num = +string.substring(pos, ptr++);
				insns.push(stack => stack.push(num));
				break;
			}
			default: throw new Error("Unknown opcode: " + ch);
		}
	}
	for (const lbl of lbls) {
		if (!(lbl in bmap)) {
			throw new Error("Label not in jump table: " + lbl);
		}
	}
	return [bmap, insns];
}

function makeFunc(acnt, lcnt, code) {
	const [bmap, insns] = decode(code, acnt + lcnt);
	return {acnt, lcnt, bmap, insns};
}

/**
 * This is the main runtime - manages coroutines, call state, etc.
 * Tries its absolute best not to blow the stack.
 *
 * (TODO: Make it do a setTimeout yield every so often?)
 */
async function execs(funcs, main, ins, globals) {
	let callstack = [];
	let coro_stack = [];
	let stack = [];
	let state;
	const replace_stack = new_stack => {
		callstack.push([stack, state, code]);
		callstack = new_stack;
		[stack, state, code] = callstack.pop();
	};
	const make_state = (func, args) => ({
		ip: 0,
		branch(v) { this.ip = func.bmap[v]; },
		perform_call(v) {
			const func = funcs[v];
			const args = stack.splice(stack.length - func.acnt, func.acnt);
			//if (trace) console.log("call", v, args);
			callstack.push([stack, state, code]);
			stack = [];
			state = make_state(func, args);
			code = func.insns;
		},
		make_coro(v) {
			const func = funcs[v];
			const args = stack.splice(stack.length - func.acnt, func.acnt);
			return {
				is_coro: true,
				callstack: [[[], make_state(func, args), func.insns]],
				enter_coro(p) {
					coro_stack.push([this, p, callstack]);
					replace_stack(this.callstack);
				},
				next() { return { done: true }; },
			};
		},
		do_yield: val => {
			if (!coro_stack.length) {
				throw new Error("Can't yield value inside non-coro: " + val);
			}
			[coro, _, new_callstack] = coro_stack.pop();
			coro.callstack = callstack;
			replace_stack(new_callstack);
			stack.push(val);
		},
		locals: args.concat(new Array(func.lcnt)),
		globals,
	});
	let code = funcs[main].insns;
	state = make_state(funcs[main], ins);
	while (true) {
		while (state.ip < code.length) {
			//console.log(state.ip, stack);
			const next = code[state.ip++](stack, state);
			if (next instanceof Promise) {
				const val = await next;
				if (val !== undefined) {
					stack.push(val);
				}
			}
		}
		if (callstack.length) {
			const values = stack;
			//if (trace) console.log("exit call");
			[stack, state, code] = callstack.pop();
			stack.push(...values);
		} else if (coro_stack.length) {
			[coro, p, callstack] = coro_stack.pop();
			coro.is_coro = false; // decay to empty iterator
			[stack, state, code] = callstack.pop();
			state.branch(p);
		} else {
			return stack;
		}
	}
}
