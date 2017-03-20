



// ABDEL KOUMARE 

// the code starts at line 537 after : 
// For thorough comments on the previous questions please refer to my previous submissions 

// =====================================================================================================================================================
// ==============================================================ASSIGNMENT 3=======================================================================================
// =====================================================================================================================================================


// Convert a closure (template binding) into a serialized string.
// This is assumed to be an object with fields params, body, env.
function stringify(b) {
    // We'll need to keep track of all environments seen.  This
    // variable maps environment names to environments.
    var envs = {};
    // A function to gather all environments referenced.
    // to convert environment references into references to their
    // names.
    function collectEnvs(env) {
        // Record the env, unless we've already done so.
        if (envs[env.name])
            return;
        envs[env.name] = env;
        // Now go through the bindings and look for more env references.
        for (var b in env.bindings) {
            var c = env.bindings[b];
            if (c!==null && typeof(c)==="object") {
                if ("env" in c) {
                    collectEnvs(c.env);
                }
            }
        }
        if (env.parent!==null)
            collectEnvs(env.parent);
    }
    // Ok, first step gather all the environments.
    collectEnvs(b.env);
    // This is the actual structure we will serialize.
    var thunk = { envs:envs ,
                  binding:b
                };
    // And serialize it.  Here we use a feature of JSON.stringify, which lets us
    // examine the current key:value pair being serialized, and override the
    // value.  We do this to convert environment references to environment names,
    // in order to avoid circular references, which JSON.stringify cannot handle.
    var s = JSON.stringify(thunk,function(key,value) {
        if ((key=='env' || key=='parent') && typeof(value)==='object' && value!==null && ("name" in value)) {
            return value.name;
        }
        return value;
    });
    return s;
}

// Convert a serialized closure back into an appropriate structure.
function unstringify(s) {
    var envs;
    // A function to convert environment names back to objects (well, pointers).
    function restoreEnvs(env) {
        // Indicate that we're already restoring this environmnet.
        env.unrestored = false;
        // Fixup parent pointer.
        if (env.parent!==null && typeof(env.parent)==='number') {
            env.parent = envs[env.parent];
            // And if parent is unrestored, recursively restore it.
            if (env.parent.unrestored)
                restoreEnvs(env.parent);
        }
        // Now, go through all the bindings.
        for (var b in env.bindings) {
            var c = env.bindings[b];
            // If we have a template binding, with an unrestored env field
            if (c!==null && typeof(c)==='object' && c.env!==null && typeof(c.env)==='number') {
                // Restore the env pointer.
                c.env = envs[c.env];
                // And if that env is not restored, fix it too.
                if (c.env.unrestored)
                    restoreEnvs(c.env);
            }
        }
    }
    var thunk;
    try {
        thunk = JSON.parse(s);
        // Some validation that it is a thunk, and not random text.
        if (typeof(thunk)!=='object' ||
            !("binding" in thunk) ||
            !("envs" in thunk))
            return null;

        // Pull out our set of environments.
        envs = thunk.envs;
        // Mark them all as unrestored.
        for (var e in envs) {
            envs[e].unrestored = true;
        }
        // Now, recursively, fixup env pointers, starting from
        // the binding env.
        thunk.binding.env = envs[thunk.binding.env];
        restoreEnvs(thunk.binding.env);
        // And return the binding that started it all.
        return thunk.binding;
    } catch(e) {
        // A failure in unparsing it somehow.
        return null;
    }
}


// These tokens are trivial, made of the literal characters we want to recognize, and ensuring it is at
// the start of the string.
var TSTART = /^{{/;
var TEND = /^}}/;
var DSTART = /^{:/;
var DEND = /^:}/;
var PSTART = /^{{{/;
var PEND = /^}}}/;
// Pipe is a bit trickier, since "|" is a special character in RegExp's, so we need to escape it.
var PIPE = /^\|/;

// These rest rely on the same idea.  We match at least 1 character, consisting of a choice between
// something that could not be any of the disallowed tokens, or which is part of a disallowed
// token, but not followed by the rest of it.  For this we make use of the "x(?!y)" operator.

// For PNAME, we can recognize anything but "}", or "}" not followed by another "}", or "}}"
// not followed by another "}".
var PNAME = /^([^}|]|}(?!})|}}(?!}))+/;

// OUTERTEXT recognizes anything but "{", or "{" not followed by either of "{" or ":"
var OUTERTEXT = /^([^{]|{(?!({|:)))+/;

// INNERTEXT recognizes anything but "{" or "|", or "}", or "{" not followed by "{" or ":",
// or "}" not followed by another "}"
var INNERTEXT = /^([^{|}]|{(?!({|:))|}(?!}))+/;

// INNERDTEXT recognizes anything but "{" or "|", or ":", or "{" not followed by "{" or ":",
// or ":" not followed by "}"
var INNERDTEXT = /^([^{|:]|{(?!({|:))|:(?!}))+/;

// Returns the token located at the beginning of s, where the set of allowed tokens
// is given by an object tokenset, as per the assignment format.
// Syntactically correct input is assumed, and the tokenset is assumed appropriate
// for the input too, so we do not need to check for errors of any form.
function scan(s,tokenset) {
    // Inside here we just need to check for each regexp we defined in q1.
    // Tokens are disjoint in all valid cases, except for TSTART and PSTART,
    // which we resolve by always checking for PSTART first.

    // just for debugging
    // var ss = "{ ";
    // for (var t in tokenset) {
    //     ss += t + ": "+tokenset[t]+", ";
    // }
    // addDebugText("Token set: "+ss+"}\n");

    // To go over all tokens we create an array of objects mapping names to the 
    // corresponding regexp variables we created in q1.  We use an array
    // so we can check them in a specific order.
    var tokens = [
        { name:"PSTART", regexp:PSTART },
        { name:"PEND", regexp:PEND },
        { name:"TSTART", regexp:TSTART }, 
        { name:"TEND", regexp:TEND } ,
        { name:"DSTART", regexp:DSTART },
        { name:"DEND", regexp:DEND },
        { name:"PIPE", regexp:PIPE },
        { name:"PNAME", regexp:PNAME },
        { name:"OUTERTEXT", regexp:OUTERTEXT },
        { name:"INNERTEXT", regexp:INNERTEXT },
        { name:"INNERDTEXT", regexp:INNERDTEXT } ];

    // Now, iterative through our tokens array, and see what we find
    for (var i=0; i<tokens.length; i++) {
        var m;
        if (tokenset[tokens[i].name] && (m = s.match(tokens[i].regexp))) {
            return { token:tokens[i].name, value:m[0] };
        }
    }
    throw "Hey, there aren't supposed to be syntactic errors, but I encountered \""+s+"\"";
}

// Parsing the <outer> rule.
function parseOuter(s) {
    // As a base case, if we are fed the empty string just return null.
    if (s=="")
        return null;

    // Find out which of the 3 tokens we know about are at the start of the string.
    var t = scan(s,{OUTERTEXT:true,TSTART:true,DSTART:true});

    // Make up the object we will return; we modify fields below.
    var obj = {name:"outer",
               OUTERTEXT:null,
               templateinvocation:null,
               templatedef:null,
               next:null,
               // We'll keep track of the length of s we consumed in this and all
               // recursive calls here too.
               length:0};

    // And construct the returned object for each of the 3 cases.
    switch (t.token) {
    case 'OUTERTEXT':
        obj.OUTERTEXT = t.value;
        // Skip over consumed token.
        obj.length += t.value.length;
        s = s.substr(obj.length);
        break;
    case 'TSTART':
        obj.templateinvocation = parseTemplateInvocation(s);
        // Update how far we got in through the string.
        obj.length += obj.templateinvocation.length;
        s = s.substr(obj.templateinvocation.length);
        break;
    case 'DSTART':
        obj.templatedef = parseTemplateDef(s);
        // Update how far we got in through the string.
        obj.length += obj.templatedef.length;
        s = s.substr(obj.templatedef.length);
        break;
    }
    // We might have more outer pieces, so keep going.
    obj.next = parseOuter(s);
    // Update length to include everything we consumed.
    if (obj.next!==null)
        obj.length += obj.next.length;
    return obj;
}

// Parsing the <templateinvocation> rule. We assume the inital TSTART is at the front of the string.
function parseTemplateInvocation(s) {
    // Make up the object we will return; we modify fields below.
    var obj = {name:"templateinvocation",
               itext:null,
               targs:null,
               length:0};

    // First we need to skip over the initial token, which must be a TSTART.
    var t = scan(s,{TSTART:true});
    obj.length = t.value.length;
    // And skip over consumed token.
    s = s.substr(obj.length);

    // Next we find the name.  This is an itext, which is a list, and so might be empty.
    obj.itext = parseItext(s);
    if (obj.itext!=null) {
        obj.length += obj.itext.length;
        s = s.substr(obj.itext.length);
        // Strip WS.
        obj.itext = pruneWS(obj.itext,"INNERTEXT");
    }

    // Then parse through the argument list.  Again, this is a list, and it might be empty.
    obj.targs = parseTargs(s);
    if (obj.targs!=null) {
        obj.length += obj.targs.length;
        s = s.substr(obj.targs.length);
    }

    // Finally, we must end with a TEND, so this is guaranteed to exist.
    var t = scan(s,{TEND:true});
    obj.length += t.value.length;
    return obj;
}

// Remove leading and trailing whitespace from our lists.
// Not strictly necessary, as we have to prune it once we evaluate it again anyway,
// but since it was asked for in the assignment here it is.
// The field parameter should be INNERTEXT, or INNERDTEXT as necessary.
function pruneWS(list,field) {
    // Note that we assume our 
    function pruneLeading(list,field) {
        if (list!=null && list[field]!==null) {
            list[field] = list[field].replace(/^\s+/,'');
        }
        return list;
    }
    function pruneTrailing(inlist,field) {
        var list = inlist;
        while (list!=null && list.next!=null) 
            list = list.next;
        if (list!=null && list[field]!==null) {
            list[field] = list[field].replace(/\s+$/,'');
        }
        return inlist;
    }
    return pruneTrailing(pruneLeading(list,field),field);
}

// Parsing itext.  This returns a linked list of objects, possibly null.
function parseItext(s) {
    // An empty string could be a base case.  Strictly speaking, however, parsing <itext> 
    // should never actually terminate in anything other than a PIPE or a TEND, so this
    // is just being over-cautious.
    if (s=="")
        return null;

    // See which token is at the start of the string.
    var t = scan(s,{INNERTEXT:true,TSTART:true,DSTART:true,PSTART:true,PIPE:true,TEND:true});

    // If we scanned PIPE or TEND, then we are done, at a base case.
    if (t.token=="PIPE" || t.token=="TEND")
        return null;

    // Otherwise, we have a legitimate itext rule expansion, as INNERTEXT, an invoc, def, or param.
    var obj = {name:"itext",
               INNERTEXT:null,
               templateinvocation:null,
               templatedef:null,
               tparam:null,
               next:null,
               length:0};

    // And now build the object to be returned.
    switch (t.token) {
    case 'INNERTEXT':
        obj.INNERTEXT = t.value;
        // Skip over consumed token.
        obj.length += t.value.length;
        s = s.substr(obj.length);
        break;
    case 'TSTART':
        obj.templateinvocation = parseTemplateInvocation(s);
        // Update how far we got in through the string.
        obj.length += obj.templateinvocation.length;
        s = s.substr(obj.templateinvocation.length);
        break;
    case 'DSTART':
        obj.templatedef = parseTemplateDef(s);
        // Update how far we got in through the string.
        obj.length += obj.templatedef.length;
        s = s.substr(obj.templatedef.length);
        break;
    case 'PSTART':
        obj.tparam = parseTParam(s);
        // Update how far we got in through the string.
        obj.length += obj.tparam.length;
        s = s.substr(obj.tparam.length);
        break;
    }

    // We might have more pieces to the itext list, so keep going.
    obj.next = parseItext(s);
    // Update length consumed to include the remaining pieces too
    if (obj.next!==null)
        obj.length += obj.next.length;
    return obj;
}

// Parsing targs.  This is another list.
function parseTargs(s) {
    // To start with we should see a PIPE or a TEND.  If we see TEND, then
    // we are done with our list.
    var t = scan(s,{PIPE:true,TEND:true});
    if (t.token=='TEND') 
        return null;

    // Ok, we saw a PIPE, so we know we have an argument (and maybe more).

    var obj = {name:"targs",
               itext:null,
               next:null,
               length:t.value.length};

    // Skip over the PIPE.
    s = s.substr(obj.length);

    // Parse the ensuing itext.
    obj.itext = parseItext(s);
    if (obj.itext!=null) {
        obj.length += obj.itext.length;
        s = s.substr(obj.itext.length);
        obj.itext = pruneWS(obj.itext,"INNERTEXT");
    }

    // There might be more arguments, so keep parsing recursively.
    obj.next = parseTargs(s);
    if (obj.next!=null)
        obj.length += obj.next.length;
    return obj;
}

// Parsing <templatedef>.  Very much like parsing an invocation, we get here once we've
// already recognized the DSTART, so we know it starts with one.
function parseTemplateDef(s) {
    var obj = {name:"templatedef",
               // It's all one big list of dtext, but it's a bit easier if we at least split
               // off the name from the rest of it.
               dtext:null,
               dparams:null,
               length:0};

    // First we need to skip over the initial token, which must be a DSTART.
    var t = scan(s,{DSTART:true});
    obj.length = t.value.length;
    // And skip over consumed token.
    s = s.substr(obj.length);

    // Next we find the template name.  This is a dtext.
    obj.dtext = parseDtext(s);
    if (obj.dtext!=null) {
        obj.length += obj.dtext.length;
        s = s.substr(obj.dtext.length);
        // Strip WS.
        obj.dtext = pruneWS(obj.dtext,"INNERDTEXT");
    }

    // Then the parameter list.
    obj.dparams = parseDparams(s);
    // The dparams list cannot be null, as we always have a body.
    obj.length += obj.dparams.length;
    s = s.substr(obj.dparams.length);

    // Clean off any leading/trailing ws from the args, but not the body.
    var d = obj.dparams;
    while(d.next!=null) {
        d.dtext = pruneWS(d.dtext,"INNERDTEXT");
        d = d.next;
    }

    // Finally, we must end with a DEND, so this is guaranteed to exist.
    var t = scan(s,{DEND:true});
    obj.length += t.value.length;
    return obj;
}

// Parsing dtext.  This is quite similar to parseItext, just terminating
// in a DEND instead of TEND, and including INNERDTEXT instead of INNERTEXT.
function parseDtext(s) {
    // Trivial base case check.
    if (s=="")
        return null;

    // See which token is at the start of the string.
    var t = scan(s,{INNERDTEXT:true,TSTART:true,DSTART:true,PSTART:true,PIPE:true,DEND:true});

    // If we scanned PIPE or DEND, then we are done, at a base case.
    if (t.token=="PIPE" || t.token=="DEND")
        return null;

    // Otherwise, we have a legitimate dtext rule expansion, as INNERDTEXT, an invoc, def, or param.
    var obj = {name:"dtext",
               INNERDTEXT:null,
               templateinvocation:null,
               templatedef:null,
               tparam:null,
               next:null,
               length:0};

    // And now build the object to be returned.
    switch (t.token) {
    case 'INNERDTEXT':
        obj.INNERDTEXT = t.value;
        obj.length += t.value.length;
        // Skip over consumed token.
        s = s.substr(obj.length);
        break;
    case 'TSTART':
        obj.templateinvocation = parseTemplateInvocation(s);
        // Update how far we got in through the string.
        obj.length += obj.templateinvocation.length;
        s = s.substr(obj.templateinvocation.length);
        break;
    case 'DSTART':
        obj.templatedef = parseTemplateDef(s);
        // Update how far we got in through the string.
        obj.length += obj.templatedef.length;
        s = s.substr(obj.templatedef.length);
        break;
    case 'PSTART':
        obj.tparam = parseTParam(s);
        // Update how far we got in through the string.
        obj.length += obj.tparam.length;
        s = s.substr(obj.tparam.length);
        break;
    }

    // We might have more pieces to the dtext list, so keep going.
    obj.next = parseDtext(s);
    // Update length consumed to include the remaining pieces too
    if (obj.next!==null)
        obj.length += obj.next.length;
    return obj;
}

// Parsing dparams.  This is another list, of parameters, and the body.
function parseDparams(s) {
    // To start with we should see a PIPE or a DEND.  If we see DEND, then
    // we are done with our list.
    var t = scan(s,{PIPE:true,DEND:true});
    if (t.token=='DEND') 
        return null;

    // Ok, we saw a PIPE, so we know we have an parameter (or body).
    var obj = {name:"dparams",
               dtext:null,
               next:null,
               length:t.value.length};

    // Skip over the PIPE.
    s = s.substr(obj.length);

    // Parse the ensuing dtext.
    obj.dtext = parseDtext(s);
    if (obj.dtext!=null) {
        obj.length += obj.dtext.length;
        s = s.substr(obj.dtext.length);
    }

    // There might be more, so keep parsing recursively.
    obj.next = parseDparams(s);
    if (obj.next!=null)
        obj.length += obj.next.length;
    return obj;
}

// Parsing a <tparam> structure.
function parseTParam(s) {
    // We get here having already seen the PSTART, so 
    // we just need to skip over that and get the name and the PEND.

    var obj = {name:"tparam",
               pname:null,
               length:0};

    // First we need to skip over the initial token, which must be a PSTART.
    var t = scan(s,{PSTART:true});
    obj.length = t.value.length;
    // And skip over consumed token.
    s = s.substr(obj.length);

    // Now scan the parameter name.
    t = scan(s,{PNAME:true});
    
    obj.pname = t.value.trim();
    obj.length += t.value.length;
    s = s.substr(t.value.length);

    // And the PEND.
    t = scan(s,{PEND:true});
    obj.length += t.value.length;
    return obj;
}


// PRINT AST NODE AND TEST* ===========



function printASTIndent(node, tabVal){

    if(typeof tabVal === 'undefined'){
        tabVal = 0;
    }
    var tabs = "";
    for(var i = 0; i < tabVal; i++){
        tabs= tabs.concat("     ");
    }
    var result = "";
    for(var param in node){
        if (node.hasOwnProperty(param)){
            var curNode;
            if(typeof node[param] === 'object' && node[param] !== null){
                curNode ='\n' + printASTIndent(node[param], tabVal+1);
                result +=tabs + param +":" + curNode;

            }
            else{
                curNode = node[param];
                result +=tabs + param +":" + curNode + '\n';
            }
        }
    }
    return result;
}



// =====================================================================================================================================================
// ==============================================================ASSIGNMENT 3=======================================================================================
// =====================================================================================================================================================



/*              Question 1

Develop code to represent environments. Environments are objects, with a (probabilistically) unique
name as a floating point number given by Math.random(), a set of bindings, and a parent environment
(object, not name).
{ name: ,
bindings: { ... },
parent: }
You should have have 2 functions associated with this structure,
* createEnv(parent), which creates a new environment.
* lookup(name,env), which returns the first binding value for binding key name. This function
searches through the given environment and then parents, returning null if no binding is found.

*/


function createEnv(parent){
return{ name: Math.random(), binding:{}, "parent": parent}

}

function lookup(name,env){
    
  


    if(env.binding!==null){ 
        
        if(env.binding[name]){
            
            return env.binding[name]
        }
    }

     
    if(env.parent== null){ 

            return null
        }
        else { 
            return lookup(name, (env.parent))
        }

}



// ======= Question 2 

/*
Develop functionality to evaluate the AST generated from your solution to assignment 2. You should 
define a set of functions for processing the different AST nodes, each of which received an AST node
and an environment, and returns a string.
At the top-level you should define function evalWML(ast,env). This function should be able to process
a (list of) outer AST nodes, evaluating text or delegating to other, appropriate eval* functions as
appropriate.
Your code should add appropriate bindings at template definitions. A definition binding is a map between
a template name, and a structure which records the parameters as an array, the body AST node, and the
defining environment.
{ 
params: ,
body: ,
env: 
}
Your code from this question should be capable of correctly executing non-trivial WML code, including
invocations, nested definitions, and recursive definitions. You should aim to implement static scoping.
*/


var name = "" // global variable
var count1= 0;
var bindObj = null;

function evalWML(ast,env){

    // console.log("================ eval WML env + AST")
    // console.log(env)
    // console.log("ast======")
    // console.log(printASTIndent(ast))

    if(ast.name=="outer"){

if(ast.OUTERTEXT){ // if the root node in as outer 
    if(ast.next)
        return ast.OUTERTEXT + evalWML(ast.next,env)  //
        return ast.OUTERTEXT

    }

}

if(ast.templatedef){ // we check if the root node's template def is not null 
    if(ast.next)
    return evalTemplateDef(ast.templatedef,env) + evalWML(ast.next,env)
    
    else
        return evalTemplateDef(ast.templatedef,env)

}

if(ast.templateinvocation){
    if(ast.next){

        return evalTemplateInvocation(ast.templateinvocation,env) + evalWML(ast.next,env)
    }
    else
    return evalTemplateInvocation(ast.templateinvocation,env)

    }

    if(ast.INNERTEXT){
      

        if(ast.next){
            return ast.INNERTEXT + evalWML(ast.next,env)
        }
        else
            return ast.INNERTEXT

    }

    if(ast.next)
        return evalWML(ast.next,env)

} // end evalWML


function evalTemplateDef(ast,env){

    /*


        HERE we have modifications from the previous questions 

    */

    var q4=false; 

    if(ast.dtext){ // dtext not null

        if((ast.dtext.INNERDTEXT).charAt(0)=="`") { // we check if there is a ` for q4 

            q4=true;
            ast.dtext.INNERDTEXT= (ast.dtext.INNERDTEXT).substr(1) // remove the `
      } 

     evalDtext(ast.dtext, env) // now evaluate the dtext 

        }



    if(ast.dparams){ // we check here if there is a dparam

        if(ast.dparams.dtext){

     evalDparam(ast.dparams, env)
    
        env.binding[name].params.pop() // get rid of the last value which is the "body"
            }
            else{ // this is for template definition with empty paramter
                env.binding[name].params.push("")

            }

      } 

      


       var sgfy =stringify(env.binding[name])   // here  we strigfy the object 


if(q4){ // if there was a backquote `

      if((ast.dtext.INNERDTEXT).substr(1)==""){  // if there is no value after the backquote likfe {:`|....}

       delete env.binding[name]                     // we remove the binding to just return the sgfy

        }

    }

 

      if(q4){ // of there is a back quote ` we return it 

           
                return sgfy
      }




       

    return ""

    }

function evalDtext(ast,env){

         name = ast.INNERDTEXT; // store the value of the name which is a global variable

         
             env.binding[ast.INNERDTEXT]= { params:[], body: null, env: env} // create an object in the envornment and set it as a binding 

         

        

    }

function evalDparam(ast,env){
    

    env.binding[name].body = ast // store in the body the next node that will be poped in evalTemplateDef

        

        if(ast.dtext.INNERDTEXT){ // if the Parameter of the template definition is a INNERDTEXT
    env.binding[name].params.push(ast.dtext.INNERDTEXT) // this fucntion adds to the array "params" all the parameters from the AST
            }

        if(ast.dtext.templatedef){ env.binding[name].params.push(ast.dtext.templatedef)} // still store it , it will be poped of

        if(ast.dtext.templateinvocation){ env.binding[name].params.push(ast.dtext.templateinvocation)}  

        if(ast.dtext.tparam){ env.binding[name].params.push(ast.dtext.tparam.pname)}  




     if(ast.next){ // if there is a "next element" recursively call evalDparam

        env.binding[name].body = ast.next // store in the body the next node that will be poped in evalTemplateDef
        evalDparam(ast.next,env)
       
    }


}


function evalTemplateInvocation(ast,env){

    if(ast.itext.INNERTEXT=="#if"){ // IF case 

        var ifres= evalIf(ast.targs,env)

        return ifres
    }

    if(ast.itext.INNERTEXT=="#ifeq"){ // IF case 

        var ifres= evalIfEq(ast.targs,env)

        return ifres
    }

    if(ast.itext.INNERTEXT=="#expr"){ // IF case 

        var ifres= evalExpr(ast.targs,env)

        return ifres
    }

    

 
  fnName = evalItext(ast.itext,env); //eval itext returns a sting that represents the function name. In Q4, it could return instead the function object in string form.
  
  

      var afterfName = unstringify(fnName)


        if(afterfName){ // we check what unstrigify returns. If it is null it means it's not an object 
            bindObj= afterfName // here we skip the lookup part 
        }
        else{
            bindObj = lookup(fnName,env); // lookup 
        }

  

// console.log("============== TEMPLATE INVOCATION ========= ")
//             console.log(printASTIndent(ast))
//             console.log(env.binding)
//             console.log("bind obj====================")
//             console.log(bindObj)
            
            

  var e1

  if(bindObj){ // if we have an binding value with the key "name"

    e1 = createEnv(bindObj.env) // create a new environment with parent E0 <-- bindObj.env to have static scoping FOR dynamic put "env"
    

  }


if(e1){  // if an object exists in e1

// now we need to map the parameters to the arguments 

    var x= ""

    if(ast.targs){ 

        evalTargs(ast.targs,e1,env) // call evalTargs  ///// HERE 2 environment passed to implement static scoping
        count1 =0; // to allow nested calls 

        
    }

    if(bindObj.body){
        x = evalBody(bindObj.body,e1) // evaluate the body only if it exists
    }

    // console.log("===============Binding object returned after from evalItext in template invocation")
    // console.log(bindObj) //

    // console.log("================================E1 returned in templateinvocation===================")
    // console.log(e1)
    // console.log("================================End E1===================")

    // console.log("================================Environment after body evaluation===================")
    // console.log(e1)

    // console.log("================================ END Environment after body evaluation" + ""+"" +"===================")

return  x

}// end if e1 exist


    return ""


} // end evalTemplateInvo



function evalItext(ast,env){

   
    
    var result = "";
  
    

   

    if(ast.INNERTEXT){


     

    
    
        if(ast.next){


            result+= ast.INNERTEXT + evalItext(ast.next,env);

           
            }

        else {
                 result+= ast.INNERTEXT
            }



    }  // end if there is INNERTEXT

    if(ast.INNERTEXT==""){
        if(ast.next)
            result+="" + evalItext(ast.next,env)
        else 
            result+=""
    }

    


   

    if(ast.templateinvocation){

            if(ast.next){
                result+= evalTemplateInvocation(ast.templateinvocation,env) + evalItext(ast.next,env)
            }
            else 
                result+= evalTemplateInvocation(ast.templateinvocation,env)

    }
 
    if(ast.templatedef){  // here there is a modification from q2,3 because the string returned by templatedef can be an object 

         
            var evaluation = evalTemplateDef(ast.templatedef,env) // this can return the strigyfied version of the object 
            


        if(ast.next){
           
                result+= evaluation+ evalItext(ast.next,env)

        }
        else {
           
            result+= evaluation;
        }

        // console.log("result after Template de ===========")
        // console.log(result)

    }


    if(ast.tparam){   

        if(ast.next){

                result+= evalBody(ast,env)+ evalItext(ast.next,env)
        }
        else
            result+= evalBody(ast,env)


    }

    
  // console.log(" HERE IS result :"+ result+"|")

return result;


    

} // end evalItext


function evalTargs(ast,env,env2){


    if(ast.itext.INNERTEXT){// THIS is to check if there is an INNERTEXT to map on the environment

if(count1!== bindObj.params.length){ // we check if the counter is less than the paramter array length

    env.binding[bindObj.params[count1]]= ast.itext.INNERTEXT  // store in the new environment the maping of paramteters and arguments
    count1++ 
}
if(ast.next)
    evalTargs(ast.next,env)

}



if(ast.itext.tparam){  // THIS HAPPENS WHEN RECCURSIVE CALLS HAPPEN

   



if(count1!== bindObj.params.length){ // we check if the counter is less than the paramter array length

    env.binding[bindObj.params[count1]]= lookup(ast.itext.tparam.pname,env2)  // this is with recursive call, lookup in the environment the value of the key
    
    count1++                                                            // pname and return it's content
}

if(ast.next)
    evalTargs(ast.next,env)

}


} // end evalTargs

function evalBody(ast,env){ 



        if(ast.name=="dparams"){
           
                ast= ast.dtext
         }

// console.log("=======================================================Evaluate body==========================================================================")
// console.log(printASTIndent(ast))
// console.log("==========env====")
// console.log(env)
//console.log("==========Environments===== ast.name:")
//console.log(ast.name)





if(ast.tparam){     // en of if it is a TPARAM


        if(ast.next){  // IF THERE US A NEXT VALUE

        if(ast.tparam.pname){ // In the case there is a TPARAM VALUE WITH A NEXT VALUE


            if(lookup(ast.tparam.pname,env)){       // if there is a match between the TPARAM and the binding
                
                return lookup(ast.tparam.pname,env) + evalBody(ast.next,env)

            }

            else{
                 return "{{{"+ ast.tparam.pname+ "}}}" + evalBody(ast.next,env)// if there is no match return the statement as it has to be

                }
        }

        }

        else { 
            
            if(ast.tparam.pname){ // IF THERE IS A TPARAM WITHOUT NEXT VALUE 

            if(lookup(ast.tparam.pname,env)){       // if there is a match between the TPARAM and the binding
                
                return lookup(ast.tparam.pname,env) 

            }else{
                    return "{{{"+ ast.tparam.pname+ "}}}" // if there is no match return the statement as it has to be

                }

        }  

        }

    }// end of if there is a tparam



    if(ast.INNERDTEXT){  // If the body has and INNERDTEXT

        if(ast.next){
            return ast.INNERDTEXT +  evalBody(ast.next,env)
        }
        else 
            return ast.INNERDTEXT


        } /// END INNERDTEXT


        if(ast.INNERTEXT){  // If the body has and INNERDTEXT

        if(ast.next){
            return ast.INNERTEXT +  evalBody(ast.next,env)
        }
        else 
            return ast.INNERTEXT


        } /// END INNERTEXT


if(ast.templateinvocation){ 
    // if it sees a template invocation in the body
                                                            
    
        if(ast.next){
        return evalTemplateInvocation(ast.templateinvocation,env) + evalBody(ast.next,env) // stoppedhere
        }

        else
            return evalTemplateInvocation(ast.templateinvocation,env)
        // deleted the .next part 


    }

if(ast.templatedef){ // if in the Body there is a templateDef 

    if(ast.next){   
        return evalTemplateDef(ast.templatedef,env) + evalBody(ast.next,env)
    }

    else
        return evalTemplateDef(ast.templatedef,env)


}


if(ast.next){
    return evalBody(ast.next,env)
}

return ""

} // END BODY
         




/*

        QUESTION 3
To be able to easily and efficiently do non-trivial computation, you will need some special functions. 
Modify your evaluation code to recognize #if, #ifeq, and #expr when invoked and perform the appropriate
behaviour


NOTE : For comments on q3 please refer to my submission of q3 
*/

function evalIf(ast,env){

    // console.log("================evalIf=====")
    // console.log(printASTIndent(ast)) 

    var cond = evalWML(ast.itext,env)  // here we evaluate the condition 

    // console.log("=========")
    // console.log("cond="+cond+"|")

    if(cond!=""){ // if the condition is true return the then part
                     console.log("========Condition is : TRUE")

        return evalWML(ast.next.itext,env)
    }
    else if(cond==""){ // if condition is false return the else part 
         console.log("========Condition is : FALSE ")

        return evalWML(ast.next.next.itext,env)

    }
}

function evalIfEq(ast,env){

    // console.log("================ evalIfeq=====")
    // console.log(printASTIndent(ast))

    var cond1 = evalWML(ast.itext,env)  // we evaluate conditon 1 and condition 2 
    var cond2 = evalWML(ast.next.itext,env)



    // console.log("cond1="+cond1+"|"+ "cond2="+ cond2)

    if(cond1==cond2){ // we check the equality 
                     console.log("========Conditions are equal ")

        return evalWML(ast.next.next.itext,env)
    }
    else if(cond1!=cond2){

         console.log("========Conditions are not equal ")

        return evalWML(ast.next.next.next.itext,env)

    }


}

function evalExpr(ast,env){

    var res = evalBody(ast.itext,env); // we evaluate the body of the expression and return the evaluation 
  
    console.log(res)
    console.log(env)
    

    return eval(res) // JS eval functon to compute the result and return it 


}





/*
    QUESTION 4 
    Add the ability to return and pass around a template declaration as a first-class value. As described in 10
class, this is done by recognizing the single-backquote ‘ character as the first character in a template
name (but is excluded from the actual name of the template).
In this your code should allow for anonymous templates to be returned, expressed as templates with no
name (other than the ‘.). Note that returned templates with names are still recorded as bindings in the
current environment, but anonymous templates are not.
To return a template, convert the template binding value to a string. When a returned template is subsequently
encountered in an invocation, it must be converted back to a binding value. Use the stringify
and unstringify functions provided (these are for your convenience, you may develop your own).
Note that there is some uncertainty in an invoke as to whether the template being invoked is specified by
name or by a binding

NOTE: THis is a modified version of q2,3. I did my best so taht I can work for the most cases I could think about, yet the code cand still be improved 
and might have some flaws. This is as far as I could get avec many hours of work. 
Thank you 
*/














env0= createEnv(null)
//var result1 =evalWML(parseOuter("{:Tdef1|param1|param2| Hi there {{{param1}}} {{ Tdef2|{{{param2}}} }} me :} {:Tdef2|k| part2 {{{k}}} :} {{Tdef1|COMP|302}} "),env0 )

//var test= " {:scope|static:} {:showscope|You have {{scope}} scoping.:} {:dyntest|{:scope|dynamic:}{{showscope}}:} {{dyntest}} "
//var result1= evalWML(parseOuter(test),env0)
//var result1= evalWML(parseOuter("{:foo|{{{a}}}:}{:bar|a|{{foo}}:}{{bar|hello}}"),env0) // represents static scoping 

//var result1= evalWML(parseOuter("{:Tdef1|param1|{:Tdef2|para11| body2:} end body1 {{{param1}}}:} {{Tdef1|COMP 302 }} "),env0)
//var result1= evalWML(parseOuter("{:hello|arg1|arg2|arg3|hello {{{arg1}}}:} {{hello |2|then|else}} hello TA"),env0)

//var result1 = evalWML(parseOuter("{{#if|{:foo|:}{{foo}}|true|false}}"),env0)
//var result1 = evalWML(parseOuter("{{#if|2|then|else}}"),env0)
//var result1 = evalWML(parseOuter("{{#ifeq|abc|def|true|false}}"),env0)
//var result1= evalWML(parseOuter("{{#ifeq|abc|{:foo|abc:}{{foo}}|true|false}}"),env0)

//var result1= evalWML(parseOuter("{:hello|param1|param2|{{#expr|{{{param1}}}*{{{param2}}}}}:} {{hello|5|8}}"),env0)
//var result1= evalWML(parseOuter("{{#expr|5*5}}"),env0)

//var result1= evalWML(parseOuter("{:foo|hello:} {{ {:bar|foo:}{{bar}} }}"),env0) //should output hello

//var result1= evalWML(parseOuter("{{ {:`foo|x|beep {{{x}}}:}|hello}} {{foo|second Hello}}"),env0)
//var result1= evalWML(parseOuter("{:foo|x|{{{x}}} whassup:} {{foo|hello|2}}"),env0)

//var result1=evalWML(parseOuter("{{{:`foo|x|{{{x}}} beep:}|hello,}} {{foo|thank you}}"),env0)
//var result1=evalWML(parseOuter("{{{:`foo|x|{{{x}}} beep:}|hello,}} {{f {{foo|oo}}|this works!}}"),env0)

var result1=evalWML(parseOuter("{{{:`foo|x|{{{x}}} beep:}|first hello}} {{foo|thank you}}"),env0)



//result1=evalWML(parseOuter("{{ {{ {:`CN0|f|{:`|x|{{{x}}}:}:}|{:`|y|iter{{{y}}}:}}}|hello}}"),env0)




console.log("\n================================Result: ===================\n")

console.log(result1) // print result here

console.log("\n ============= End Result Result===========")

console.log("===================================================")

console.log("===================================================")



















