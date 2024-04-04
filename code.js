/**
 * Source code for COSIDA and various tech tests.
 *
 * Each string is a function name, each string is a Spindle program.
 * With one exception, programs are non-whitespace-sensitive
 * (so some code here is minified and some isn't.)
 * I tried to pick mnemonics to be pretty memorable - no guarantees I succeeded!
 *
 * The REPL in the main function right now is just a test -
 * the functions that get invoked are ?, U, and (the main function) S.
 */
const test_code = {
	// fibonacci
	'F': makeFunc(1, 0, "02$ L0 a- d <E  CF 01$ L0 a- CF a+ Jz  #E p L0 #z"),
	// fibonacci but concerning
	'f': makeFunc(1, 1, "0-1$ L0 0$ S0 #l d<z S1 02$ L1 a- d<a 01$ L1 a- Jl #a p L0L1a+S0 Jl #z p L0"),
	// map with *
	'M': makeFunc(1, 0, "L0 li le S0  #l d Nz C* L0 lp Jl  #z p L0"),
	// double
	'*': makeFunc(1, 0, "L0 02$ a*"),
	// render 8-bit number
	'8': makeFunc(1, 1, "leS10128$#ldL0a&Bn00$Je#n01$#eL1lp01$sa>dBlpL1cj"),
	// write a string of a certain format out
	'W': makeFunc(3, 0, "\\ L2Bs\\C\\L\\RJ1#s\\S\\E\\T#1P3cjL1C8\\:L0P4cJ"),
	// ...secret!
	'|': makeFunc(3, 0, "L0 li le S0  #l d Nz L2 d 01$ sa> S2 01$ a& Ze co L1 a| cc #e L0 lp Jl #z p L0 cj"),
	'&': makeFunc(3, 0, "L1 a~ S1 L0 li le S0  #l d Nz L2 d 01$ sa> S2 01$ a& Ze co L1 a& cc #e L0 lp Jl #z p L0 cj"),
	// count words in structure (SLOW)
	// dict ptr  chr ptr+off
	'#': makeFunc(2, 2, "L1L03d07$sa>S20127$a&L102$a+S3#sdZz0-1$a+L0L3L05L1a+C#L2a+S2L305$a+S3Js#zpL2"),

	// recursive yield test
	'1': makeFunc(0, 0, "01$ Y C2 03$ Y"),
	'2': makeFunc(0, 0, "02$ Y"),
	'A': makeFunc(0, 1, "le d 0$ slp S0 K1 #l dNz L0 lp Jl #z p L0 cj"),
}

const code = {
	// tune a set of pitches
	't': makeFunc(1, 0, "L0 li le S0 #l dNz 012$ sa/ 02$ aP 0.11$ a* L0 lp Jl #z p L0"),
	// synthesize sound or snare
	// notes  bufferlen amplitude audiobuffer bufferarray index acc
	'*': makeFunc(1, 6, "02000$ S1 L0 li Ns p L0 Ct S0 L1 Rb @ d S3 R5 @ S4 0.15$ S2 0$ S5 #l 0$ S6 L0 li #b dNq L5 a* 02$ sa% 0-1$ a+ L6 a+ S6 Jb #q p L6 L2 a* L5 L4 ls L2 0.9997$ a* S2 L5 01$ a+ d S5 L1 a- Bl L3 J$ #t L1 Rb @ d S3 R5 @ S4 0.3$ S2 0$ S5 #u 03$ aR L2 a* L5 L4 ls L2 0.997$ a* S2 L5 01$ a+ d S5 L1 a- Bu L3 d Rc lp J$ #s Rc li Nt #$"),
	// fizzbuzz
	'f': makeFunc(1, 2, "015$ L0 a% dBa p 03$ #a S2 le S1 ce 03$ L0 a% B3 \\F \\I \\Z \\Z P4 cj a+ L2 d d L1 lp 03$ a+ L1 lp 07$ a+ S2 #3 05$ L0 a% B5 \\B \\U \\Z \\Z P4 cj sa+ L2 d L1 lp 05$ a+ L1 lp #5 d ll Bz p L0 P1 cj #z L1"),
	// 13821305463347
	'F': makeFunc(0, 0, "0$ #l d 045$ a- Zz 01$ a+ d Cf C* R% @ R> @ Jl #z"),

	// look up word
	// dict list  ptr chr ptr+off
	'?': makeFunc(2, 3, "L1liS104$S2#lL2L03L1NycoS30127$a&L201$a+S4#sdZz0-1$a+L4L03L3a-BqpL2L401$a+L05a+S2Jl#qL405$a+S4Js#y07$sa>#z"),
	// unpack 5-bit word
	'w': makeFunc(1, 0, "L0 le S0 #l d Zz d 031$ a& 064$ a| cc L0 lp 05$ sa> Jl #z p L0 cj"),
	// print about text
	'A': makeFunc(0, 0, "R@R>@"),
	// given word, return capitalized + mask for word
	'U': makeFunc(1, 2, "L0 li le S0 0$ S1 01$ S2 Jm #l L0 lp 01$ L2 a< S2 #m dNz d co 0-33$ a& d 0-65$ a+ <f d 0-91$ a+ <t #f p Jl #t sp cc L2 L1 a+ S1 Jl #z p L0 cj L1"),
	// spell-check
	'S': makeFunc(0, 1, "RD d 0$ s5 R1 a+ R2 sa+ R> @ #l d RS R< @ dZz dll Zf CU p dS0 C? Bt R- Je #t R+ #e L0 a+ R> @ Jl #f p Jl #z p p ce R> @"),
	// help info
	'H': makeFunc(0, 1, "ce R> @ R! li S0 R# li #s d Nz Usp L0 Ny \\: s P3 \\  s cJ R> @ Js #y p #z p"),
	// skip whitespace
	'_': makeFunc(2, 0, "L0 co Zf L0 #l d co 032$ a- Be p L1 Nf Jl #f 0$ J$ #e 01$ #$"),
	// char to integer
	'I': makeFunc(1, 0, "L0 co 0-58$ a+ d<s JF #s 010$ a+ d<F #O 01$ J$ #F p 0$ #$"),
	// decode operator
	'o': makeFunc(1, 0, "L0coS0 L0037$a-Z% L0042$a-Z* L0043$a-Z+ L0045$a-Z- L0047$a-Z/ L0094$a-Z^ 0$J$ #%00$04$JK #*04$01$JK #+02$02$JK #-02$03$JK #/04$04$JK #^06$05$JK #K01$ #$"),
	// apply operator
	'a': makeFunc(3, 0, "L0 L1 L2Z% L20-1$a+Z* L20-2$a+Z+ L20-3$a+Z- L20-4$a+Z/ L20-5$a+Z^ #%a%J$ #*a*J$ #+a+J$ #-a-J$ #/a/J$ #^aPJ$ #$"),
	// Pratt parser/evaluator; see https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
	// head precedence stream  value operator-id right-precedence
	'c': makeFunc(3, 3, `
		L0 L2 C_ Z1 d S0
		co 040$ a- Bb
		L2 N1 0$ L2 Cc ZF
		S3 L2 C_ Z3 co 041$ a- B3
		L2 Nr S0 JM
		#b L0 co 045$ a- Bc
		L2 N1 d S0 09$ L2 Cc ZF
		0$ a- S3 S0 JM
		#c L0 CI Z4 S3
		0$ cc S0
		#d L2 NM d CI Zl 
		L3 010$ a* a+ S3 p Jd
		#l S0
		#M L0 L2 C_ Zr d S0
		Co ZR S4 d S5 L1 sa- <R
		L2 N1 L5 01$ a+ L2 Cc ZF
		L3 L4 Ca S3 S0 JM
		#1 01$ JF
		#3 03$ JF
		#4 04$ JF
		#F 0$ J$

		#r 0$ cc S0
		#R L0 L3 01$
		#$`),
	// Run the parser
	'm': makeFunc(1, 1, "L0 li d S0 Na Jb #a 0$ cc #b 0$ L0 Cc Ze S1 L0 C_ Bx L1 0$ J$ #x 02$ #e 0-1$ a+ RE lr 01$ #$ s"),
	'C': makeFunc(0, 1, "#l RC R< @ dZz dll Zf Cm S0 Zs 019384901$ Je #s 0684379314$ #e Cw \\: L0 P3 \\  scJ R> @ Jl #f p Jl #z p ce R> @"),
	
	// main loop
	'0': makeFunc(0, 1, "RI R> @ #l RP R< @ dZz dll Zf CU p S0 R# li #s d Nq U L0 a= Bc p Js #c I #f p Jl #q p R? R> @ Jl #z \\Q \\U \\I \\T P4 cj R> @"),
};

// Demo programs!

//execs(test_code, 'F', [12]).then(console.log);
//execs(test_code, 'f', [15]).then(console.log);
//execs(test_code, 'M', [[1, 2, 3]]).then(console.log);
//execs(test_code, '8', [81]).then(console.log);
//execs(test_code, 'W', ["LEGO", 4, true]).then(console.log);
//execs(test_code, '|', ["HACK", 4, 15]).then(console.log);
//execs(code, 'U', ["Dog S!"]).then(console.log);
//execs(test_code, 'A', []).then(console.log);
//execs(code, 'F', []).then(console.log);
