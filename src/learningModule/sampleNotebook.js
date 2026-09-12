/**
 * The notebook a teacher gets from "New notebook".
 *
 * A worked example rather than a blank page: it shows every moving part of a
 * tested exercise — a teacher guide, a hidden setup cell, a locked example, and
 * two questions with starter code, sample input and hidden test cases — so the
 * first thing a teacher sees is how the pieces fit, not an empty cell.
 *
 * The cells marked 🧑‍🏫 are for the teacher and say to delete them before
 * publishing. Everything else is written to be handed to students as it is.
 *
 * Kept in step with `testRunner.js` and the two kernels: what the guide says
 * about input and output matching is what they actually do.
 */

const PYTHON_GUIDE = `## 🧑‍🏫 Teacher guide — delete this cell before publishing

This sample shows how to set up a coding exercise with hidden test cases. Students see every cell except **Hidden setup** cells, so delete the 🧑‍🏫 cells before you publish.

### What to write in a code cell, and what to leave to the student
- The code you leave in a cell is exactly what each student starts with. Write the **starter code**: the lines that read the input, the function names, and \`# TODO\` comments. Leave the logic out.
- To check your test cases, paste your reference solution into the cell, press **Test Cases** → **Test Solution on Cell**, then put the starter code back before you save. The reference solutions for the two questions are at the end of this guide.
- Tick **Locked** on a cell students should run but not edit (examples, imports).

### How test inputs reach the student's code
- Each hidden test case has an **Input** and an **Expected output**. When a test runs, its Input is fed to the cell as if typed at the keyboard.
- Each line of the Input is returned by one \`input()\` call. Input \`3 4\` is one line, read with \`a, b = map(int, input().split())\`. An Input on two lines needs two \`input()\` calls.
- The **Input** box under a cell is only sample input for the ▶ button. It is copied to students, so fill it with an example. Hidden tests ignore it and use their own Input.

### How the output is checked
- Everything the cell prints is compared with the Expected output. Spaces at the end of lines and blank lines at the start or end are ignored. Everything else must match exactly, including capital letters.
- Don't put a prompt inside \`input()\`. Write \`input()\`, not \`input("Enter a number: ")\`, because the prompt is printed and breaks the match. Put instructions in a text cell instead.
- Print only the answer. \`The sum is 7\` fails a test that expects \`7\`.
- A test on a cell with no Input is fine: leave the Input empty and check only what it prints.

### Are Python cells connected? Yes
- All Python cells share one session. A function or variable made in one cell can be used in any cell run **after** it, as in Jupyter. (C notebooks are different: there every cell is a separate program.)
- The cell that defines it has to be run first. **Restart** or **Stop** clears everything until the cells are run again.

### Helper functions (sub-functions)
- Define them in the same cell, one after another, **above** the code that calls them. Question 2 shows this.
- Tests run one cell at a time. A function defined in a different visible cell only exists if the student ran that cell first, so keep everything a test needs in the tested cell.
- A function students should call but not write goes in a **Hidden setup** cell. It runs before every student cell and every test. \`read_ints()\` in the hidden cell below is an example.

### Reference solutions
Question 1:

\`\`\`python
a, b = map(int, input().split())
print(a + b)
\`\`\`

Question 2 (replace the two functions, keep the main program):

\`\`\`python
def is_prime(n):
    if n < 2:
        return False
    for d in range(2, int(n ** 0.5) + 1):
        if n % d == 0:
            return False
    return True


def count_primes(numbers):
    return sum(1 for x in numbers if is_prime(x))
\`\`\`
`;

const PYTHON_SETUP = `# HIDDEN SETUP (teacher only). Students never see this cell, but it runs before
# any of their cells and before every hidden test. Put imports, data and helper
# functions here that students may call but should not have to write.

def read_ints():
    """Reads one line of input and returns it as a list of integers."""
    return list(map(int, input().split()))
`;

const PYTHON_INTRO = `## Warm-up: reading input

Cells are connected: a function you define in one cell can be used in later cells, once you have run the cell that defines it.

Code cells read input with \`input()\`. Each call reads one line. Press **Input** under a cell to see or change what it reads, then press ▶ to run the cell.

A cell with a **Run Hidden Test Case** button is also checked against inputs you can't see. For those cells, print only the answer, with no extra words.`;

const PYTHON_EXAMPLE = `# This cell is locked: you can run it and change its Input, but not the code.
name = input()          # reads one line from the Input box
print("Hello,", name)
`;

const PYTHON_Q1 = `### Question 1: sum of two numbers

- **Input:** one line with two integers separated by a space.
- **Output:** their sum.

Example:

\`\`\`
Input:  3 4
Output: 7
\`\`\`

Complete the cell below, press ▶ to try it, then press **Run Hidden Test Case**.`;

const PYTHON_Q1_CODE = `# This line is done for you: for the input "3 4" it sets a = 3 and b = 4.
a, b = map(int, input().split())

# TODO: print the sum of a and b
`;

const PYTHON_Q2 = `### Question 2: counting primes, using helper functions

- **Input:** the first line holds N. The second line holds N integers.
- **Output:** how many of those integers are prime.

Example:

\`\`\`
Input:
5
2 3 4 5 6

Output:
3
\`\`\`

Write the two functions. The main program at the bottom of the cell calls them, so keep the functions above it, all in the same cell. \`read_ints()\` is provided for you: it reads one line and returns a list of integers.`;

const PYTHON_Q2_CODE = `def is_prime(n):
    # TODO: return True if n is a prime number, otherwise False
    pass


def count_primes(numbers):
    # TODO: use is_prime() to count how many numbers in the list are prime
    pass


# Main program: reads the input and prints the answer. You don't need to change it.
n = int(input())            # line 1: how many numbers
numbers = read_ints()       # line 2: the numbers
print(count_primes(numbers))
`;

const C_GUIDE = `## 🧑‍🏫 Teacher guide — delete this cell before publishing

This sample shows how to set up a C exercise with hidden test cases. Students see every cell except **Hidden setup** cells, so delete the 🧑‍🏫 cells before you publish.

### ⚠️ Every C cell is an individual program
- Each code cell is compiled and run **on its own**, with its own \`main()\`. It is not connected to any other cell.
- A function, variable, \`#define\` or \`struct\` written in one cell **cannot be used in another cell**, even the cell right below it and even after the first cell has run. Trying it fails with \`undefined symbol\`.
- So each exercise cell must contain everything it needs: its \`#include\` lines, its helper functions (above \`main()\`) and its own \`main()\`.
- The only code shared by all cells is the **Hidden setup** cell, which is pasted in front of every cell before it compiles.

### What to write in a code cell, and what to leave to the student
- The code you leave in a cell is exactly what each student starts with. Write the **starter code**: the \`#include\` lines, the \`scanf\` calls that read the input, the function headers, and \`/* TODO */\` comments. Leave the logic out.
- To check your test cases, paste your reference solution into the cell, press **Test Cases** → **Test Solution on Cell**, then put the starter code back before you save. The reference solutions for the two questions are at the end of this guide.
- Tick **Locked** on a cell students should run but not edit.

### How test inputs reach the student's code
- Each hidden test case has an **Input** and an **Expected output**. When a test runs, its Input is fed to the program as its stdin.
- \`scanf("%d", ...)\` skips spaces and line breaks, so \`3 4\` on one line and \`3\` and \`4\` on two lines read the same way. \`fgets\` reads one whole line.
- Reading past the end of the Input returns EOF, the same as a piped file, so the program never waits for more.
- The **Input** box under a cell is only sample input for the ▶ button. It is copied to students, so fill it with an example. Hidden tests ignore it and use their own Input.

### How the output is checked
- Everything the program prints is compared with the Expected output. Spaces at the end of lines and blank lines at the start or end are ignored. Everything else must match exactly, including capital letters.
- Don't print prompts such as \`printf("Enter a number: ")\` in a tested cell, because they become part of the output. Put instructions in a text cell instead.
- Print only the answer. \`The sum is 7\` fails a test that expects \`7\`.

### Helper functions (sub-functions)
- Define them in the same cell, one after another, **above** \`main()\`, or declare a prototype above \`main()\`. Question 2 shows this. They can't go in a separate visible cell, because C cells aren't connected.
- A function students should call but not write goes in a **Hidden setup** cell. It is pasted in front of every cell before it compiles, so it must not have its own \`main()\`. \`read_int()\` in the hidden cell below is an example.

### Reference solutions
Question 1:

\`\`\`c
#include <stdio.h>

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a + b);
    return 0;
}
\`\`\`

Question 2 (replace the two functions, keep main):

\`\`\`c
bool is_prime(int n) {
    if (n < 2) return false;
    for (int d = 2; d * d <= n; d++) {
        if (n % d == 0) return false;
    }
    return true;
}

int count_primes(const int values[], int n) {
    int count = 0;
    for (int i = 0; i < n; i++) {
        if (is_prime(values[i])) count++;
    }
    return count;
}
\`\`\`
`;

// No entry point in here, not even in a comment: the server rejects a hidden C
// cell whose text matches `main(`.
const C_SETUP = `/* HIDDEN SETUP (teacher only). Students never see this cell. It is pasted in
   front of every student cell before it compiles, so put shared #include lines
   and helper functions here that students may call but should not write. */
#include <stdio.h>

/* Reads the next integer from the input. Returns 0 if there is none left. */
int read_int(void) {
    int value = 0;
    if (scanf("%d", &value) != 1) return 0;
    return value;
}
`;

const C_INTRO = `## Warm-up: reading input

**Each code cell is a separate program** with its own \`main()\`. Cells are not connected: a function you write in one cell can't be used in another cell, so keep everything a program needs in its own cell.

Programs read input with \`scanf\`. Press **Input** under a cell to see or change what it reads, then press ▶ to compile and run it.

A cell with a **Run Hidden Test Case** button is also checked against inputs you can't see. For those cells, print only the answer, with no extra words.`;

const C_EXAMPLE = `#include <stdio.h>

/* This cell is locked: you can run it and change its Input, but not the code. */
int main(void) {
    char name[50];
    scanf("%49s", name);            /* reads one word from the Input box */
    printf("Hello, %s\\n", name);
    return 0;
}
`;

const C_Q1 = `### Question 1: sum of two numbers

- **Input:** two integers separated by a space.
- **Output:** their sum.

Example:

\`\`\`
Input:  3 4
Output: 7
\`\`\`

Complete the program below, press ▶ to try it, then press **Run Hidden Test Case**.`;

const C_Q1_CODE = `#include <stdio.h>

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);   /* done for you: for the input "3 4" it sets a = 3, b = 4 */

    /* TODO: print the sum of a and b, followed by a newline */

    return 0;
}
`;

const C_Q2 = `### Question 2: counting primes, using helper functions

- **Input:** the first line holds N (at most 100). The second line holds N integers.
- **Output:** how many of those integers are prime.

Example:

\`\`\`
Input:
5
2 3 4 5 6

Output:
3
\`\`\`

Write the two functions. \`main()\` at the bottom calls them, so keep the functions above it, all in the same cell. They must be in this cell: C cells are separate programs, so a function written in another cell can't be called from here. \`read_int()\` is provided for you: it reads the next integer from the input.`;

const C_Q2_CODE = `/* This cell is a complete program on its own. Its helper functions must be
   written here, above main(): functions from other cells can't be used. */
#include <stdio.h>
#include <stdbool.h>

/* TODO: return true if n is a prime number, otherwise false */
bool is_prime(int n) {
    return false;
}

/* TODO: use is_prime() to count how many of the n values are prime */
int count_primes(const int values[], int n) {
    return 0;
}

/* Reads the input and prints the answer. You don't need to change it. */
int main(void) {
    int n = read_int();                 /* line 1: how many numbers */
    int values[100];
    for (int i = 0; i < n && i < 100; i++) {
        values[i] = read_int();         /* line 2: the numbers */
    }
    printf("%d\\n", count_primes(values, n));
    return 0;
}
`;

// Shared by both languages: the answers do not depend on the kernel. The prime
// cases avoid an expected answer of 0, which the C starter would pass by
// accident, since its stub already returns 0.
const SUM_TESTS = [
  { input: '3 4', output: '7' },
  { input: '10 -2', output: '8' },
  { input: '0 0', output: '0' },
  { input: '1000000 2000000', output: '3000000' },
];

const PRIME_TESTS = [
  { input: '5\n2 3 4 5 6', output: '3' },
  { input: '4\n1 0 9 7', output: '1' },
  { input: '4\n11 13 17 19', output: '4' },
  { input: '3\n-5 1 2', output: '1' },
];

const markdown = (source) => ({ type: 'markdown', source });

const buildSample = ({ guide, setup, intro, example, q1, q1Code, q2, q2Code }) => [
  markdown(guide),
  { type: 'code', source: setup, hidden: true },
  markdown(intro),
  { type: 'code', source: example, stdin: 'Ada\n', locked: true },
  markdown(q1),
  { type: 'code', source: q1Code, stdin: '3 4\n', testCases: SUM_TESTS },
  markdown(q2),
  { type: 'code', source: q2Code, stdin: '5\n2 3 4 5 6\n', testCases: PRIME_TESTS },
];

export const SAMPLE_NOTEBOOK_CELLS = {
  python: buildSample({
    guide: PYTHON_GUIDE,
    setup: PYTHON_SETUP,
    intro: PYTHON_INTRO,
    example: PYTHON_EXAMPLE,
    q1: PYTHON_Q1,
    q1Code: PYTHON_Q1_CODE,
    q2: PYTHON_Q2,
    q2Code: PYTHON_Q2_CODE,
  }),
  c: buildSample({
    guide: C_GUIDE,
    setup: C_SETUP,
    intro: C_INTRO,
    example: C_EXAMPLE,
    q1: C_Q1,
    q1Code: C_Q1_CODE,
    q2: C_Q2,
    q2Code: C_Q2_CODE,
  }),
};

/**
 * A single starter cell, for the "Insert example" button on an empty code cell.
 * One exercise with its sample input and a couple of test cases, so a teacher
 * can press Test Solution straight away and see the whole loop work.
 */
export const EXAMPLE_CELL = {
  python: {
    source: `# Starter code: students replace the TODO with their own code.

def add(a, b):
    # TODO: return the sum of a and b
    pass


# Reads the input: one input() call for each line of the test's Input.
a, b = map(int, input().split())
print(add(a, b))
`,
    stdin: '3 4\n',
    testCases: [
      { input: '3 4', output: '7' },
      { input: '10 -2', output: '8' },
    ],
  },
  c: {
    source: `#include <stdio.h>

/* TODO: return the sum of a and b */
int add(int a, int b) {
    return 0;
}

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);          /* reads the test's Input, e.g. "3 4" */
    printf("%d\\n", add(a, b));
    return 0;
}
`,
    stdin: '3 4\n',
    testCases: [
      { input: '3 4', output: '7' },
      { input: '10 -2', output: '8' },
    ],
  },
};
