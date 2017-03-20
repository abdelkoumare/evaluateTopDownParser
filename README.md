# evaluateTopDownParser
code to evaluate the WML language parsed in the previous repository

Here are the requirement to which the code answers to :


1. Develop code to represent environments. Environments are objects, with a (probabilistically) unique 
name as a floating point number given by Math.random(), a set of bindings, and a parent environment
(object, not name).
f name: ,
bindings: f ... g,
parent: g
You should have have 2 functions associated with this structure,
 createEnv(parent), which creates a new environment.
 lookup(name,env), which returns the first binding value for binding key name. This function
searches through the given environment and then parents, returning null if no binding is found.

2. Develop functionality to evaluate the AST generated from your solution to assignment 2. You should 
define a set of functions for processing the different AST nodes, each of which received an AST node
and an environment, and returns a string.
At the top-level you should define function evalWML(ast,env). This function should be able to process
a (list of) outer AST nodes, evaluating text or delegating to other, appropriate eval* functions as
appropriate.
Your code should add appropriate bindings at template definitions. A definition binding is a map between
a template name, and a structure which records the parameters as an array, the body AST node, and the
defining environment.
f params: ,
body: ,
env: g
Your code from this question should be capable of correctly executing non-trivial WML code, including
invocations, nested definitions, and recursive definitions. You should aim to implement static scoping.


3. To be able to easily and efficiently do non-trivial computation, you will need some special functions. 5

Modify your evaluation code to recognize #if, #ifeq, and #expr when invoked and perform the appropriate
behaviour.

4. Add the ability to return and pass around a template declaration as a first-class value. As described in 10
class, this is done by recognizing the single-backquote ‘ character as the first character in a template
name (but is excluded from the actual name of the template).
In this your code should allow for anonymous templates to be returned, expressed as templates with no
name (other than the ‘.). Note that returned templates with names are still recorded as bindings in the
current environment, but anonymous templates are not.
To return a template, convert the template binding value to a string. When a returned template is subsequently
encountered in an invocation, it must be converted back to a binding value. Use the stringify
and unstringify functions provided (these are for your convenience, you may develop your own).
Note that there is some uncertainty in an invoke as to whether the template being invoked is specified by
name or by a binding.
