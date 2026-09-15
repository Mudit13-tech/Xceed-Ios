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
 * The Python sample then carries Lab Assignment 13 (modules and packages) as
 * worked solutions — see PYTHON_LAB_CELLS for how its cells write module files
 * into the kernel's in-memory file system and import them.
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
  // The first is the worked example. A sample is how the student learns that
  // two numbers arrive on one line and a bare integer goes back — and the
  // sample notebook is where a teacher learns to set one, so it has to have
  // one rather than describe it.
  { input: '3 4', output: '7', isSample: true },
  { input: '10 -2', output: '8' },
  { input: '0 0', output: '0' },
  { input: '1000000 2000000', output: '3000000' },
];

const PRIME_TESTS = [
  // Sampled for the same reason, and more so: this input is two lines, and
  // nothing but a sample would tell the student that.
  { input: '5\n2 3 4 5 6', output: '3', isSample: true },
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

// ── Lab Assignment 13: Modules and Packages (Python only) ─────────────────────
//
// Worked solutions, appended after the two questions above. Most of these
// questions need their own .py files. The kernel has a working directory
// (/home/pyodide) that is on sys.path and lasts until a restart, so a "files
// cell" writes the modules there with open() and the program cell after it
// imports them. `%%writefile` is a Jupyter magic this kernel does not run.
//
// Hidden tests run in the same kernel, so they see the files once the files
// cell has run. Each program cell drops earlier imports first, because Python
// would otherwise keep running the version it imported before an edit.

const LAB_INTRO = `## Lab Assignment 13: Modules and Packages

Most questions below build their own module or package. A notebook has no file browser, so each of those questions has two code cells:

1. A **files cell** creates the \`.py\` files with \`open()\` and \`write()\`. Run it first.
2. A **program cell** imports the module and uses it. This is the cell the hidden tests run.

Things to know:
- The files stay until the kernel restarts. After **Restart** or **Stop**, run the files cell again before the program cell.
- To change a module, edit its files cell, run it, then run the program cell again. The program cell imports the module afresh, so it picks up the change.
- Jupyter's \`%%writefile\` doesn't work here. Use \`open()\`, as the files cells do.
- Menu programs read every choice and value from the **Input** box, one per line. When the Input runs out, the program stops as if you had chosen Exit. The menu itself isn't printed, because it would become part of the output the tests check.

🧑‍🏫 **For the teacher:** these cells hold worked solutions. To set them as an exercise, replace the function bodies in each files cell with \`# TODO\` and \`pass\` before publishing. Check the test cases with the solution first.`;

/** A cell that writes a question's module files, so the program cell can import them. */
const labFilesCell = (files) => ({
  type: 'code',
  source: `# Creates the files for this question. Run this cell before the program below it.
import importlib
import os

files = {
${files.map(([path, code]) => `    "${path}": ${code ? `'''\n${code}'''` : '""'},`).join('\n')}
}

for path, code in files.items():
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    with open(path, "w") as f:
        f.write(code)
    print("Created", path)

# Python remembers what it found in each folder; this makes it look again.
importlib.invalidate_caches()
`,
});

/** Drops any earlier import of a module or package, so edits to its files take effect. */
const forgetImports = (name) => `import sys

# Forget any earlier import of ${name}, so changes to its files take effect.
for name in list(sys.modules):
    if name == "${name}" or name.startswith("${name}."):
        del sys.modules[name]
`;

// Q1 ─────────────────────────────────────────────────────────────────────────

const LAB_Q1 = `### Q1. Module \`math_operations\`

Create \`math_operations.py\` with functions for addition, subtraction, multiplication and division, and a function \`majority_element(items)\`. It returns the element that occurs more than half the time, or \`None\` when there is none, without using any built-in function. Then import the module and use it on the numbers in the Input.

- **Input:** line 1 holds two numbers. Line 2 holds a list of integers.
- **Output:** the four results, then the majority element.

\`\`\`
Input:
8 2
3 3 4 2 3 3 3

Output:
Addition: 10.0
Subtraction: 6.0
Multiplication: 16.0
Division: 4.0
Majority element: 3
\`\`\``;

const MATH_OPERATIONS_PY = `"""Arithmetic operations, and a majority-element finder."""


def add(a, b):
    return a + b


def subtract(a, b):
    return a - b


def multiply(a, b):
    return a * b


def divide(a, b):
    """Returns a / b, or None when b is 0."""
    if b == 0:
        return None
    return a / b


def majority_element(items):
    """Returns the element that occurs more than half the time, or None.

    Boyer-Moore voting, with no built-in functions. The first pass finds the
    only element that could be the majority; the second counts it to check.
    """
    candidate = None
    votes = 0
    for item in items:
        if votes == 0:
            candidate = item
            votes = 1
        elif item == candidate:
            votes += 1
        else:
            votes -= 1

    count = 0
    total = 0
    for item in items:
        total += 1
        if item == candidate:
            count += 1

    if total > 0 and count * 2 > total:
        return candidate
    return None
`;

const LAB_Q1_CODE = `${forgetImports('math_operations')}import math_operations

a, b = map(float, input().split())
items = list(map(int, input().split()))

print("Addition:", math_operations.add(a, b))
print("Subtraction:", math_operations.subtract(a, b))
print("Multiplication:", math_operations.multiply(a, b))

quotient = math_operations.divide(a, b)
if quotient is None:
    print("Division: cannot divide by zero")
else:
    print("Division:", quotient)

majority = math_operations.majority_element(items)
if majority is None:
    print("Majority element: none")
else:
    print("Majority element:", majority)
`;

const LAB_Q1_TESTS = [
  {
    input: '8 2\n3 3 4 2 3 3 3',
    output: 'Addition: 10.0\nSubtraction: 6.0\nMultiplication: 16.0\nDivision: 4.0\nMajority element: 3',
    isSample: true,
  },
  {
    input: '5 0\n1 2 3',
    output: 'Addition: 5.0\nSubtraction: 5.0\nMultiplication: 0.0\nDivision: cannot divide by zero\nMajority element: none',
  },
  {
    input: '-3 4\n2 2 1 1 2',
    output: 'Addition: 1.0\nSubtraction: -7.0\nMultiplication: -12.0\nDivision: -0.75\nMajority element: 2',
  },
  {
    input: '7.5 2.5\n4',
    output: 'Addition: 10.0\nSubtraction: 5.0\nMultiplication: 18.75\nDivision: 3.0\nMajority element: 4',
  },
  {
    input: '1 1\n1 2 1 2',
    output: 'Addition: 2.0\nSubtraction: 0.0\nMultiplication: 1.0\nDivision: 1.0\nMajority element: none',
  },
];

// Q2 ─────────────────────────────────────────────────────────────────────────

const LAB_Q2 = `### Q2. Package \`geometry\`

Create a package \`geometry\` with \`circle.py\` (area and circumference of a circle) and \`rectangle.py\` (area and perimeter of a rectangle). Then import the package and use it.

- **Input:** line 1 holds the radius. Line 2 holds the length and width.
- **Output:** the four results, to 2 decimal places.

\`\`\`
Input:
7
4 3

Output:
Circle area: 153.94
Circle circumference: 43.98
Rectangle area: 12.00
Rectangle perimeter: 14.00
\`\`\``;

const CIRCLE_PY = `import math


def area(radius):
    return math.pi * radius * radius


def circumference(radius):
    return 2 * math.pi * radius
`;

const RECTANGLE_PY = `def area(length, width):
    return length * width


def perimeter(length, width):
    return 2 * (length + width)
`;

const LAB_Q2_CODE = `${forgetImports('geometry')}from geometry import circle, rectangle

radius = float(input())
length, width = map(float, input().split())

print(f"Circle area: {circle.area(radius):.2f}")
print(f"Circle circumference: {circle.circumference(radius):.2f}")
print(f"Rectangle area: {rectangle.area(length, width):.2f}")
print(f"Rectangle perimeter: {rectangle.perimeter(length, width):.2f}")
`;

const LAB_Q2_TESTS = [
  {
    input: '7\n4 3',
    output: 'Circle area: 153.94\nCircle circumference: 43.98\nRectangle area: 12.00\nRectangle perimeter: 14.00',
    isSample: true,
  },
  {
    input: '1\n2.5 2',
    output: 'Circle area: 3.14\nCircle circumference: 6.28\nRectangle area: 5.00\nRectangle perimeter: 9.00',
  },
  {
    input: '0\n0 0',
    output: 'Circle area: 0.00\nCircle circumference: 0.00\nRectangle area: 0.00\nRectangle perimeter: 0.00',
  },
  {
    input: '10\n1.5 0.5',
    output: 'Circle area: 314.16\nCircle circumference: 62.83\nRectangle area: 0.75\nRectangle perimeter: 4.00',
  },
];

// Q3 ─────────────────────────────────────────────────────────────────────────

const LAB_Q3 = `### Q3. The \`math\` module

Find the factorial, square root and greatest common divisor (GCD) of numbers from the Input, using Python's own \`math\` module. There are no files to create for this one.

- **Input:** line 1 holds a whole number for the factorial. Line 2 holds a number for the square root. Line 3 holds two whole numbers for the GCD.
- **Output:** the three results. The square root is rounded to 4 decimal places.

\`\`\`
Input:
5
16
12 18

Output:
Factorial: 120
Square root: 4.0
GCD: 6
\`\`\``;

const LAB_Q3_CODE = `import math

n = int(input())
x = float(input())
a, b = map(int, input().split())

if n < 0:
    print("Factorial: not defined for negative numbers")
else:
    print("Factorial:", math.factorial(n))

if x < 0:
    print("Square root: not defined for negative numbers")
else:
    print("Square root:", round(math.sqrt(x), 4))

print("GCD:", math.gcd(a, b))
`;

const LAB_Q3_TESTS = [
  { input: '5\n16\n12 18', output: 'Factorial: 120\nSquare root: 4.0\nGCD: 6', isSample: true },
  { input: '0\n2\n17 5', output: 'Factorial: 1\nSquare root: 1.4142\nGCD: 1' },
  { input: '10\n0.25\n0 9', output: 'Factorial: 3628800\nSquare root: 0.5\nGCD: 9' },
  {
    input: '-3\n-4\n-8 12',
    output: 'Factorial: not defined for negative numbers\nSquare root: not defined for negative numbers\nGCD: 4',
  },
];

// Q4 ─────────────────────────────────────────────────────────────────────────

const LAB_Q4 = `### Q4. Package \`student_management\`

Create a package \`student_management\` with \`add_student.py\` (add a student's name, roll number and marks), \`update_marks.py\` (update one student's marks) and \`view_students.py\` (show every student). Then write a menu-driven program that uses it.

**Input:** one menu choice per line, each followed by the lines it needs:
- \`1\` Add a student: then the name, the roll number and the marks, one per line.
- \`2\` Update marks: then the roll number and the new marks, one per line.
- \`3\` View all students.
- \`4\` Exit.

\`\`\`
Input:
1
Asha
101
88
3
4

Output:
Added Asha
Roll: 101, Name: Asha, Marks: 88.0
\`\`\``;

const ADD_STUDENT_PY = `def add_student(students, name, roll, marks):
    """Adds a student. Returns False if the roll number is already taken."""
    for student in students:
        if student["roll"] == roll:
            return False
    students.append({"name": name, "roll": roll, "marks": marks})
    return True
`;

const UPDATE_MARKS_PY = `def update_marks(students, roll, marks):
    """Sets a student's marks. Returns False if no student has that roll number."""
    for student in students:
        if student["roll"] == roll:
            student["marks"] = marks
            return True
    return False
`;

const VIEW_STUDENTS_PY = `def view_students(students):
    if not students:
        print("No students yet")
        return
    for student in students:
        print(f"Roll: {student['roll']}, Name: {student['name']}, Marks: {student['marks']}")
`;

const LAB_Q4_CODE = `${forgetImports('student_management')}from student_management.add_student import add_student
from student_management.update_marks import update_marks
from student_management.view_students import view_students

# Menu: 1 = add, 2 = update marks, 3 = view all, 4 = exit.
students = []

while True:
    try:
        choice = input().strip()
        if choice == "4":
            break
        elif choice == "1":
            # Read every line first, so a bad value can't leave one behind.
            name = input().strip()
            roll_text = input()
            marks_text = input()
            roll, marks = int(roll_text), float(marks_text)
            if add_student(students, name, roll, marks):
                print("Added", name)
            else:
                print(f"Roll {roll} already exists")
        elif choice == "2":
            roll_text = input()
            marks_text = input()
            roll, marks = int(roll_text), float(marks_text)
            if update_marks(students, roll, marks):
                print(f"Updated marks for roll {roll}")
            else:
                print(f"Roll {roll} not found")
        elif choice == "3":
            view_students(students)
        else:
            print("Invalid choice")
    except ValueError:
        print("Roll and marks must be numbers")
    except EOFError:        # the Input ran out: the same as choosing Exit
        break
`;

const LAB_Q4_TESTS = [
  {
    input: '1\nAsha\n101\n88\n1\nRavi\n102\n75\n2\n102\n81\n3\n4',
    output: 'Added Asha\nAdded Ravi\nUpdated marks for roll 102\nRoll: 101, Name: Asha, Marks: 88.0\nRoll: 102, Name: Ravi, Marks: 81.0',
    isSample: true,
  },
  { input: '3\n4', output: 'No students yet' },
  {
    input: '1\nAsha\n101\n90\n1\nMeena\n101\n70\n2\n999\n50\n9\n3',
    output: 'Added Asha\nRoll 101 already exists\nRoll 999 not found\nInvalid choice\nRoll: 101, Name: Asha, Marks: 90.0',
  },
  { input: '1\nAsha\n101\nabc\n3\n4', output: 'Roll and marks must be numbers\nNo students yet' },
  {
    input: '1\nZoe\n7\n60.5\n2\n7\n99.5\n3',
    output: 'Added Zoe\nUpdated marks for roll 7\nRoll: 7, Name: Zoe, Marks: 99.5',
  },
];

// Q5 ─────────────────────────────────────────────────────────────────────────

const LAB_Q5 = `### Q5. Package \`operations\` with sub-packages

Create this package. Each file holds the function of the same name.

\`\`\`
operations/
├── basic/
│   ├── average.py
│   ├── mean.py
│   └── median.py
└── ml/
    ├── accuracy.py
    ├── recall.py
    ├── precision.py
    └── f1score.py
\`\`\`

The ML metrics are:
- Accuracy = (TP + TN) / (TP + TN + FP + FN)
- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- F1-score = 2 × (Precision × Recall) / (Precision + Recall)

For example, a malaria testing kit gives TP = 70 (predicted positive, has malaria), TN = 80 (predicted negative, does not have it), FP = 30 (predicted positive, does not have it) and FN = 20 (predicted negative, has it).

- **Input:** line 1 holds a list of numbers. Line 2 holds TP, TN, FP and FN.
- **Output:** the average, mean and median of the list, then the four metrics rounded to 4 decimal places.

\`\`\`
Input:
2 4 4 5 10
70 80 30 20

Output:
Average: 5.0
Mean: 5.0
Median: 4.0
Accuracy: 0.75
Precision: 0.7
Recall: 0.7778
F1-score: 0.7368
\`\`\``;

const AVERAGE_PY = `def average(numbers):
    """The sum of the numbers divided by how many there are."""
    return sum(numbers) / len(numbers)
`;

const MEAN_PY = `def mean(numbers):
    """The arithmetic mean, worked out with a loop instead of sum() and len().

    Average and mean are the same quantity; the lab asks for a module of each.
    """
    total = 0
    count = 0
    for number in numbers:
        total += number
        count += 1
    return total / count
`;

const MEDIAN_PY = `def median(numbers):
    """The middle value, or the mean of the two middle values for an even count."""
    ordered = sorted(numbers)
    middle = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2
`;

const ACCURACY_PY = `def accuracy(tp, tn, fp, fn):
    total = tp + tn + fp + fn
    return (tp + tn) / total if total else 0.0
`;

const PRECISION_PY = `def precision(tp, fp):
    return tp / (tp + fp) if tp + fp else 0.0
`;

const RECALL_PY = `def recall(tp, fn):
    return tp / (tp + fn) if tp + fn else 0.0
`;

const F1SCORE_PY = `# The leading dot means "a module in this same sub-package" (operations.ml).
from .precision import precision
from .recall import recall


def f1_score(tp, fp, fn):
    p = precision(tp, fp)
    r = recall(tp, fn)
    return 2 * (p * r) / (p + r) if p + r else 0.0
`;

const LAB_Q5_CODE = `${forgetImports('operations')}from operations.basic.average import average
from operations.basic.mean import mean
from operations.basic.median import median
from operations.ml.accuracy import accuracy
from operations.ml.precision import precision
from operations.ml.recall import recall
from operations.ml.f1score import f1_score

numbers = list(map(float, input().split()))
tp, tn, fp, fn = map(int, input().split())

print("Average:", average(numbers))
print("Mean:", mean(numbers))
print("Median:", median(numbers))
print("Accuracy:", round(accuracy(tp, tn, fp, fn), 4))
print("Precision:", round(precision(tp, fp), 4))
print("Recall:", round(recall(tp, fn), 4))
print("F1-score:", round(f1_score(tp, fp, fn), 4))
`;

const LAB_Q5_TESTS = [
  {
    input: '2 4 4 5 10\n70 80 30 20',
    output: 'Average: 5.0\nMean: 5.0\nMedian: 4.0\nAccuracy: 0.75\nPrecision: 0.7\nRecall: 0.7778\nF1-score: 0.7368',
    isSample: true,
  },
  {
    input: '1 2 3 4\n50 40 10 0',
    output: 'Average: 2.5\nMean: 2.5\nMedian: 2.5\nAccuracy: 0.9\nPrecision: 0.8333\nRecall: 1.0\nF1-score: 0.9091',
  },
  {
    input: '7\n0 10 0 5',
    output: 'Average: 7.0\nMean: 7.0\nMedian: 7.0\nAccuracy: 0.6667\nPrecision: 0.0\nRecall: 0.0\nF1-score: 0.0',
  },
  {
    input: '3 1 2\n1 1 1 1',
    output: 'Average: 2.0\nMean: 2.0\nMedian: 2.0\nAccuracy: 0.5\nPrecision: 0.5\nRecall: 0.5\nF1-score: 0.5',
  },
];

// Q6 ─────────────────────────────────────────────────────────────────────────

const LAB_Q6 = `### Q6. The \`datetime\` module

Using only the built-in \`datetime\` module:
1. Show the current date and time.
2. Work out how many days are left until the next New Year (1 January).
3. Read a date of birth and work out the exact age in years, months and days.
4. Find the day of the week of a date from the Input.

- **Input:** line 1 holds a date of birth. Line 2 holds any date. Write both as YYYY-MM-DD, for example \`2004-08-15\`.

This cell has no hidden tests: the current time, the days until New Year and the age are different every day.`;

const LAB_Q6_CODE = `from datetime import date, datetime


def days_until_new_year(today):
    return (date(today.year + 1, 1, 1) - today).days


def add_months(day, months):
    """The date \`months\` months after \`day\`, moved back to the end of a short month."""
    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    day_of_month = day.day
    while True:
        try:
            return date(year, month, day_of_month)
        except ValueError:        # e.g. 31 February: try the 30th, then the 29th...
            day_of_month -= 1


def exact_age(birth, today):
    """Age as (years, months, days)."""
    months = (today.year - birth.year) * 12 + today.month - birth.month
    if add_months(birth, months) > today:
        months -= 1               # this month's birthday date hasn't come yet
    days = (today - add_months(birth, months)).days
    return months // 12, months % 12, days


def parse_date(text):
    return datetime.strptime(text.strip(), "%Y-%m-%d").date()


now = datetime.now()
today = now.date()
print("Current date and time:", now.strftime("%d-%m-%Y %H:%M:%S"))
print("Days until New Year:", days_until_new_year(today))

try:
    birth = parse_date(input())
    if birth > today:
        print("The date of birth is in the future")
    else:
        years, months, days = exact_age(birth, today)
        print(f"Age: {years} years, {months} months, {days} days")

    day = parse_date(input())
    print(f"{day.strftime('%d-%m-%Y')} is a {day.strftime('%A')}")
except ValueError:
    print("Write dates as YYYY-MM-DD, for example 2004-08-15")
`;

// Q7 ─────────────────────────────────────────────────────────────────────────

const LAB_Q7 = `### Q7. Module \`string_utils\`

Create \`string_utils.py\` with these functions, written without built-in string methods such as \`.lower()\` or \`.split()\`:
- \`count_vowels(s)\` returns how many vowels \`s\` has.
- \`reverse_string(s)\` returns \`s\` backwards.
- \`is_palindrome(s)\` returns \`True\` if \`s\` reads the same backwards, ignoring spaces and capital letters.
- \`word_frequency(s)\` returns a dictionary of each word and how many times it occurs.

- **Input:** one line of text.
- **Output:** the result of each function.

\`\`\`
Input:
never odd or even

Output:
Vowels: 6
Reversed: neve ro ddo reven
Palindrome: True
Word frequency: {'never': 1, 'odd': 1, 'or': 1, 'even': 1}
\`\`\``;

const STRING_UTILS_PY = `"""String helpers written without str methods such as .lower() or .split()."""

VOWELS = "aeiouAEIOU"


def count_vowels(s):
    count = 0
    for ch in s:
        if ch in VOWELS:
            count += 1
    return count


def reverse_string(s):
    result = ""
    for ch in s:
        result = ch + result
    return result


def _to_lower(ch):
    """One character in lower case, using character codes instead of .lower()."""
    if "A" <= ch <= "Z":
        return chr(ord(ch) + 32)
    return ch


def is_palindrome(s):
    """True if s reads the same backwards, ignoring spaces and capital letters."""
    cleaned = ""
    for ch in s:
        if ch != " ":
            cleaned += _to_lower(ch)
    return cleaned == reverse_string(cleaned)


def word_frequency(s):
    """Each word in s, mapped to how many times it occurs. Words are split on spaces."""
    frequency = {}
    word = ""
    for ch in s + " ":            # the extra space ends the last word
        if ch == " ":
            if word:
                if word in frequency:
                    frequency[word] += 1
                else:
                    frequency[word] = 1
                word = ""
        else:
            word += ch
    return frequency
`;

const LAB_Q7_CODE = `${forgetImports('string_utils')}import string_utils

text = input()

print("Vowels:", string_utils.count_vowels(text))
print("Reversed:", string_utils.reverse_string(text))
print("Palindrome:", string_utils.is_palindrome(text))
print("Word frequency:", string_utils.word_frequency(text))
`;

const LAB_Q7_TESTS = [
  {
    input: 'never odd or even',
    output: "Vowels: 6\nReversed: neve ro ddo reven\nPalindrome: True\nWord frequency: {'never': 1, 'odd': 1, 'or': 1, 'even': 1}",
    isSample: true,
  },
  {
    input: 'the cat and the hat',
    output: "Vowels: 5\nReversed: tah eht dna tac eht\nPalindrome: False\nWord frequency: {'the': 2, 'cat': 1, 'and': 1, 'hat': 1}",
  },
  {
    input: 'Madam',
    output: "Vowels: 2\nReversed: madaM\nPalindrome: True\nWord frequency: {'Madam': 1}",
  },
  {
    input: 'Python is fun',
    output: "Vowels: 3\nReversed: nuf si nohtyP\nPalindrome: False\nWord frequency: {'Python': 1, 'is': 1, 'fun': 1}",
  },
];

// Q8 ─────────────────────────────────────────────────────────────────────────

const LAB_Q8 = `### Q8. Package \`converter\`

Create a package \`converter\` with:
- \`temperature.py\` to convert between Celsius, Fahrenheit and Kelvin.
- \`length.py\` to convert between metres, kilometres, miles and feet.
- \`currency.py\` to convert INR to USD, EUR and GBP, using fixed exchange rates defined as constants in the module.

Then write a menu-driven program for it that reports bad input with an error message instead of crashing.

**Input:** one menu choice per line, each followed by the lines it needs:
- \`1\` Temperature, then a line with the *from* and *to* units (1 Celsius, 2 Fahrenheit, 3 Kelvin), then the value. For example, \`1 2\` converts Celsius to Fahrenheit.
- \`2\` Length, then a line with the *from* and *to* units (1 metres, 2 kilometres, 3 miles, 4 feet), then the value.
- \`3\` Currency, then the currency to convert to (1 USD, 2 EUR, 3 GBP), then the amount in INR.
- \`4\` Exit.

\`\`\`
Input:
1
1 2
100
3
1
5000
4

Output:
100 Celsius = 212.00 Fahrenheit
5000 INR = 60.24 USD
\`\`\``;

const TEMPERATURE_PY = `"""Conversions between Celsius, Fahrenheit and Kelvin."""

ABSOLUTE_ZERO_C = -273.15


def celsius_to_fahrenheit(c):
    return c * 9 / 5 + 32


def fahrenheit_to_celsius(f):
    return (f - 32) * 5 / 9


def celsius_to_kelvin(c):
    return c + 273.15


def kelvin_to_celsius(k):
    return k - 273.15


def fahrenheit_to_kelvin(f):
    return celsius_to_kelvin(fahrenheit_to_celsius(f))


def kelvin_to_fahrenheit(k):
    return celsius_to_fahrenheit(kelvin_to_celsius(k))


TO_CELSIUS = {"Celsius": lambda c: c, "Fahrenheit": fahrenheit_to_celsius, "Kelvin": kelvin_to_celsius}
FROM_CELSIUS = {"Celsius": lambda c: c, "Fahrenheit": celsius_to_fahrenheit, "Kelvin": celsius_to_kelvin}


def convert(value, from_unit, to_unit):
    """Converts through Celsius, so three units need only these six functions."""
    celsius = TO_CELSIUS[from_unit](value)
    if celsius < ABSOLUTE_ZERO_C - 1e-9:      # allow for floating-point rounding
        raise ValueError("temperature is below absolute zero")
    return FROM_CELSIUS[to_unit](celsius)
`;

const LENGTH_PY = `"""Conversions between metres, kilometres, miles and feet."""

METRES_PER_UNIT = {
    "metres": 1.0,
    "kilometres": 1000.0,
    "miles": 1609.344,
    "feet": 0.3048,
}


def to_metres(value, unit):
    return value * METRES_PER_UNIT[unit]


def from_metres(metres, unit):
    return metres / METRES_PER_UNIT[unit]


def convert(value, from_unit, to_unit):
    if value < 0:
        raise ValueError("length cannot be negative")
    return from_metres(to_metres(value, from_unit), to_unit)
`;

const CURRENCY_PY = `"""INR to other currencies, at fixed rates in rupees per unit of each currency."""

INR_PER_USD = 83.0
INR_PER_EUR = 90.0
INR_PER_GBP = 105.0


def _check(amount):
    if amount < 0:
        raise ValueError("amount cannot be negative")


def inr_to_usd(amount):
    _check(amount)
    return amount / INR_PER_USD


def inr_to_eur(amount):
    _check(amount)
    return amount / INR_PER_EUR


def inr_to_gbp(amount):
    _check(amount)
    return amount / INR_PER_GBP
`;

const LAB_Q8_CODE = `${forgetImports('converter')}from converter import currency, length, temperature

TEMPERATURE_UNITS = ["Celsius", "Fahrenheit", "Kelvin"]
LENGTH_UNITS = ["metres", "kilometres", "miles", "feet"]
CURRENCIES = [("USD", currency.inr_to_usd), ("EUR", currency.inr_to_eur), ("GBP", currency.inr_to_gbp)]


def read_number(text):
    try:
        return float(text)
    except ValueError:
        raise ValueError(f"'{text.strip()}' is not a number")


def pick(options, text, what):
    """The option numbered \`text\`, counting from 1."""
    text = text.strip()
    if text.isdigit() and 1 <= int(text) <= len(options):
        return options[int(text) - 1]
    raise ValueError(f"choose a {what} from 1 to {len(options)}")


def convert_units(module, units):
    # Read both lines first, so a bad value can't leave one behind.
    unit_line = input()
    value_text = input().strip()
    parts = unit_line.split()
    if len(parts) != 2:
        raise ValueError("enter two unit numbers, like 1 2")
    from_unit = pick(units, parts[0], "unit")
    to_unit = pick(units, parts[1], "unit")
    result = module.convert(read_number(value_text), from_unit, to_unit)
    print(f"{value_text} {from_unit} = {result:.2f} {to_unit}")


def convert_currency():
    choice = input()
    amount_text = input().strip()
    code, to_currency = pick(CURRENCIES, choice, "currency")
    result = to_currency(read_number(amount_text))
    print(f"{amount_text} INR = {result:.2f} {code}")


# Menu: 1 = temperature, 2 = length, 3 = currency, 4 = exit.
while True:
    try:
        choice = input().strip()
    except EOFError:        # the Input ran out: the same as choosing Exit
        break
    if choice == "4":
        break
    try:
        if choice == "1":
            convert_units(temperature, TEMPERATURE_UNITS)
        elif choice == "2":
            convert_units(length, LENGTH_UNITS)
        elif choice == "3":
            convert_currency()
        else:
            print(f"Invalid choice: {choice}")
    except ValueError as error:
        print("Error:", error)
    except EOFError:
        print("Error: the Input ended in the middle of a conversion")
        break
`;

const LAB_Q8_TESTS = [
  {
    input: '1\n1 2\n100\n2\n2 3\n5\n3\n1\n5000\n4',
    output: '100 Celsius = 212.00 Fahrenheit\n5 kilometres = 3.11 miles\n5000 INR = 60.24 USD',
    isSample: true,
  },
  {
    input: '1\n3 1\n-5\n7\n2\n1 4\nabc\n3\n2\n-10\n1\n1 1\n0\n4',
    output: "Error: temperature is below absolute zero\nInvalid choice: 7\nError: 'abc' is not a number\nError: amount cannot be negative\n0 Celsius = 0.00 Celsius",
  },
  {
    input: '2\n4 1\n5280\n1\n2 3\n32\n3\n5\n100',
    output: '5280 feet = 1609.34 metres\n32 Fahrenheit = 273.15 Kelvin\nError: choose a currency from 1 to 3',
  },
  {
    input: '2\n1 9\n10\n1\n1\n10\n3\n3\n1050\n4',
    output: 'Error: choose a unit from 1 to 4\nError: enter two unit numbers, like 1 2\n1050 INR = 10.00 GBP',
  },
  { input: '1\n3 2\n0\n4', output: '0 Kelvin = -459.67 Fahrenheit' },
];

const PYTHON_LAB_CELLS = [
  markdown(LAB_INTRO),

  markdown(LAB_Q1),
  labFilesCell([['math_operations.py', MATH_OPERATIONS_PY]]),
  { type: 'code', source: LAB_Q1_CODE, stdin: '8 2\n3 3 4 2 3 3 3\n', testCases: LAB_Q1_TESTS },

  markdown(LAB_Q2),
  labFilesCell([
    ['geometry/__init__.py', ''],
    ['geometry/circle.py', CIRCLE_PY],
    ['geometry/rectangle.py', RECTANGLE_PY],
  ]),
  { type: 'code', source: LAB_Q2_CODE, stdin: '7\n4 3\n', testCases: LAB_Q2_TESTS },

  markdown(LAB_Q3),
  { type: 'code', source: LAB_Q3_CODE, stdin: '5\n16\n12 18\n', testCases: LAB_Q3_TESTS },

  markdown(LAB_Q4),
  labFilesCell([
    ['student_management/__init__.py', ''],
    ['student_management/add_student.py', ADD_STUDENT_PY],
    ['student_management/update_marks.py', UPDATE_MARKS_PY],
    ['student_management/view_students.py', VIEW_STUDENTS_PY],
  ]),
  {
    type: 'code',
    source: LAB_Q4_CODE,
    stdin: '1\nAsha\n101\n88\n1\nRavi\n102\n75\n2\n102\n81\n3\n4\n',
    testCases: LAB_Q4_TESTS,
  },

  markdown(LAB_Q5),
  labFilesCell([
    ['operations/__init__.py', ''],
    ['operations/basic/__init__.py', ''],
    ['operations/basic/average.py', AVERAGE_PY],
    ['operations/basic/mean.py', MEAN_PY],
    ['operations/basic/median.py', MEDIAN_PY],
    ['operations/ml/__init__.py', ''],
    ['operations/ml/accuracy.py', ACCURACY_PY],
    ['operations/ml/precision.py', PRECISION_PY],
    ['operations/ml/recall.py', RECALL_PY],
    ['operations/ml/f1score.py', F1SCORE_PY],
  ]),
  { type: 'code', source: LAB_Q5_CODE, stdin: '2 4 4 5 10\n70 80 30 20\n', testCases: LAB_Q5_TESTS },

  markdown(LAB_Q6),
  { type: 'code', source: LAB_Q6_CODE, stdin: '2004-08-15\n2026-01-26\n' },

  markdown(LAB_Q7),
  labFilesCell([['string_utils.py', STRING_UTILS_PY]]),
  { type: 'code', source: LAB_Q7_CODE, stdin: 'never odd or even\n', testCases: LAB_Q7_TESTS },

  markdown(LAB_Q8),
  labFilesCell([
    ['converter/__init__.py', ''],
    ['converter/temperature.py', TEMPERATURE_PY],
    ['converter/length.py', LENGTH_PY],
    ['converter/currency.py', CURRENCY_PY],
  ]),
  {
    type: 'code',
    source: LAB_Q8_CODE,
    stdin: '1\n1 2\n100\n2\n2 3\n5\n3\n1\n5000\n4\n',
    testCases: LAB_Q8_TESTS,
  },
];

export const SAMPLE_NOTEBOOK_CELLS = {
  python: [
    ...buildSample({
      guide: PYTHON_GUIDE,
      setup: PYTHON_SETUP,
      intro: PYTHON_INTRO,
      example: PYTHON_EXAMPLE,
      q1: PYTHON_Q1,
      q1Code: PYTHON_Q1_CODE,
      q2: PYTHON_Q2,
      q2Code: PYTHON_Q2_CODE,
    }),
    ...PYTHON_LAB_CELLS,
  ],
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
      { input: '3 4', output: '7', isSample: true },
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
      { input: '3 4', output: '7', isSample: true },
      { input: '10 -2', output: '8' },
    ],
  },
};
