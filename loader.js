/**
 * This file runs the setup for COSIDA; it fetches the static data blob
 * used for SPELL, initializes the console, and loads the main COSIDA program
 * into the VM for execution. It also provides the shim layer so that COSIDA
 * can call into the terminal emulator, and provides static data like strings
 * which are used for UI interactions.
 */

/**
 * words_bin is a cool and new format I'm calling SPIBER:
 *
 *   "Strings Packed In Bytewise Echelon Representation"
 *
 * It's a glorified trie. 
 *
 * The GZIPped data is laid out as follows:
 * struct {
 *     uint32 nwords;
 *     struct trie_node {
 *         unsigned is_occupied : 1;
 *         unsigned num_children : 7;
 *         struct {
 *             uint8 character;
 *             uint32 offset;
 *         } child_header[num_children];
 *         struct trie_node children[num_children];
 *     } root;
 * };
 *
 * Lookup occurs as follows: Start at the root (position 4 in the blob, after
 * the header chunk), decode the number of children, scan through children
 * for first char of the string you're searching for. If matched, add
 * the offset field to the current pointer to get the address of
 * the child node of the trie. Repeat until input string is exhausted.
 * Finally, test is_occupied bit. (Readable impl in JS commented below.)
 */
const dictionary = fetch('words_bin.gz')
	.then(res => new Response(res.body.pipeThrough(new DecompressionStream("gzip")))
			.arrayBuffer());

/*
const testWord = (word, data) => {
	let ptr = 4;
	outer: for (const ch of word) {
		const words = data.getInt8(ptr) & 0x7f;
		const ord = ch.charCodeAt(0);
		for (let i = 0; i < words; i++) {
			const offset = ptr + 1 + 5 * i;
			if (data.getInt8(offset) == ord) {
				ptr += data.getUint32(offset + 1);
				continue outer;
			}
		}
		return false;
	}
	return !!(data.getInt8(ptr) & 0x80);
}
*/

/**
 * This takes care of passing inputs and prompts back and forth.
 * Keep two queues; shift from relevant queue if empty, else yield.
 */
const promisePipe = () => {
	const inQueue = [];
	const promQueue = [];
	const notify = msg => {
		if (promQueue.length) {
			promQueue.shift()(msg);
		} else {
			inQueue.push(msg);
		}
	};
	const wait = () => {
		return new Promise(resolve => {
			if (inQueue.length) {
				resolve(inQueue.shift());
			} else {
				promQueue.push(resolve);
			}
		});
	};
	return [notify, wait];
};

let cons, ctx, globals;
document.addEventListener("DOMContentLoaded", async () => {
	const [notify, wait] = promisePipe();
	cons = new IOConsole(notify, document.querySelector("#repl"));
	// This is the entry point!
	let audioPromise = Promise.resolve(undefined);
	execs(code, '0', [], globals = {
		'D': await dictionary,
		'<': prompt => {
			cons.outputter.print(prompt);
			return wait();
		},
		'>': val => {
			console.log(val);
			cons.outputter.println(val);
			return new Promise(setTimeout);
		},
		'c': [],
		'b': length => Promise.resolve(new AudioBuffer({length, sampleRate: 8000})),
		'5': buffer => Promise.resolve(buffer.getChannelData(0)),
		'%': async buffer => {
			if (!ctx) {
				ctx = new AudioContext();
			}
			await ctx.resume();
				
			const node = new AudioBufferSourceNode(ctx, {buffer});
			node.connect(ctx.destination);
			const lastPromise = audioPromise;
			lastPromise.then(() => node.start());
			audioPromise = new Promise(resolve => {
				node.addEventListener("ended", ev => resolve());
			});
			return lastPromise;
		},
		'#': ["HELP", /*"RHYMES",*/ "SPELL", "CALC", "FIZZ", "ABOUT"].map(s => [{call_label: s[0]}, s]),
		'!': ["Display help", /*"Find rhymes(?)",*/ "Check word spellings", "4-function calc", "Sing Fizzbuzz", "About me\n\nPress CTRL-D to exit a prompt.\n"],
		'@':	"\n     <3         COSIDA mk. I : first boot 2024-04-01\n" +
			" __   |  __     Powered by Spindle v0.3\n" +
			"/--\\ .O /--\\    Living life on the web! Happy threading!\n" +
			"//\\((  ))/\\\\\n" +
			"/  < `* >  \\    Built and maintained by Alwinfy.\n",
		'I': "COSIDA boot success!\nWelcome, guest. Type HELP for help.",
		'P': "cosida$ ",
		'S': "spell> ",
		'R': "rhyme> ",
		'C': "calc> ",
		'E': ["NOT ENOUGH INPUT", "EXTRA INPUT AT END", "MISSING ')'", "EXPECTED NUMBER OR '-' OR '('"],
		'?': "Don't know that. Try HELP for help.",
		'1': "SPIBER Wordcheck - ",
		'2': " words loaded.",
		'+': " is an English word ^w^",
		'-': " is not an English word .w.",
	}).then(vals => {
		cons.outputter.println("[Spindle: COSIDA has exited.]");
		cons.input.contentEditable = false;
	}).catch(err => {
		cons.outputter.println("\x1b[31m[Spindle: COSIDA has met with an error:\n " + err + ".\n Please reload.]");
		cons.input.contentEditable = false;
		console.error(err);
	});
});
