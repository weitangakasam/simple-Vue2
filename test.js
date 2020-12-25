
function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key)
}

function def(obj, key, value) {
    Object.defineProperty(obj, key, {
        enumerable: false,
        get() {
            return value
        }
    })
}

function isDef(value) {
    return value != null && value != undefined
}

function defaultStrat(parVal, childVal, key) {
    return childVal ? childVal : parVal
}

function mergeOptions(parent, children, vm) {
    let res = {}
    function mergeKey(parVal, childVal, key) {
        let res = strats[key] ? strats[key](parVal, childVal, vm) : defaultStrat(parVal, childVal, vm)
        return res
    }
    for (let key in parent) {
        res[key] = mergeKey(parent[key], children[key], key)
    }
    for (let key in children) {
        if (!hasOwn(children[key])) {
            res[key] = mergeKey(parent[key], children[key], key)
        }
    }
    return res
}

class Vnode {
    constructor(context, tag, data, children, text, componentOption) {
        this.tag = tag
        this.key = data ? data.key : null
        this.data = data
        this.children = children
        this.text = text
        this.context = context
        this.componentOption = componentOption
    }
}
function createComponentVnode(vm, tag, data, ctor) {
    return new Vnode(
        vm,
        'component ' + tag,    //随便拼的
        {
            hooks: {
                i(vnode, parent) {                      //这个vnode是myComponent自己的vnode,上面有自己的信息
                    let instance = vnode.componentInstance = new vnode.componentOption.ctor({
                        _isComponent: true,
                        parentVnode: vnode,
                    })
                    instance.$mount()   //手动调用
                    vnode.elm = instance.$el
                    parent.appendChild(vnode.elm)
                }
            }
        },
        [],
        '',
        {
            ctor,
            listners: data.on
        }
    )
}

let reservedHTML = ['div', 'span', 'p', 'h1', 'input', 'h2']

var _c, _v, _s, _l, _e

function normalizeChildren(children) {
    if (!children) {
        return null
    }
    let res = []
    if (Array.isArray(children)) {
        for (let i = 0; i < children.length; i++) {
            let c = children[i]
            let arr = normalizeChildren(c)   //递归一下,防止nested
            res.push.apply(res, arr)    //这里是apply,所以能够一个个push进去
        }
    } else {
        res.push(children)
    }
    return res
}
function _createElement(vm, tag, data, children) {
    children = normalizeChildren(children)
    //这里有好几种情况
    if (typeof tag === 'string') {
        if (reservedHTML.indexOf(tag) > -1) {
            return new Vnode(vm, tag, data, children)
        } else {
            //用户注册的组件名称,去components对象上找,因为挂载在上面
            return createComponentVnode(vm, tag, data, vm.$options.components[tag])
        }
    } else {
        return createComponentVnode()
    }
}
function createElement(tag, data, children) {
    let vm = this
    if (Array.isArray(data)) {
        children = data
        data = {}
    }
    return _createElement(vm, tag, data, children)
}

function createTextNode(str) {
    return new Vnode(this, null, null, null, str)
}

function renderList(arr, render) {
    let ret = []
    for (let i = 0; i < arr.length; i++) {
        let vnode = render(arr[i], i)
        ret.push(vnode)
    }
    return ret
}

_l = renderList
function initRender(vm) {
    vm._c = createElement.bind(vm)
    vm._v = createTextNode.bind(vm)
    _s = str => {
        if (typeof str === 'object') {
            return JSON.stringify(str)
        } else {
            return str
        }
    }
    _e = () => {
        return createTextNode('')
    }
}

function getProxy(obj, target, key) {
    Object.defineProperty(obj, key, {
        get() {
            return obj[target][key]
        },
        set(newVal) {
            obj[target][key] = newVal
        }
    })
}

class Depend {
    constructor() {
        this.subs = []
    }
    depend() {
        if (Depend.target) {
            Depend.target.addDep(this)
        }
    }
    notify() {
        this.subs.forEach(sub => {
            sub.update()
        })
    }
    addSub(sub) {
        this.subs.push(sub)
    }
}

let activeStack = []
function pushTarget(watcher) {
    activeStack.push(watcher)
    Depend.target = watcher
}
function popTarget() {
    activeStack.pop()
    Depend.target = activeStack[activeStack.length - 1]
}

const proto = Array.prototype
const ArrayMethods = Object.create(proto)
const MethodKeys = ['splice', 'push', 'pop', 'shift', 'unshift']
MethodKeys.forEach(key => {
    let method = proto[key]
    ArrayMethods[key] = function (...args) {
        let ob = this.__ob__
        let res = method.call(this, ...args)
        let inserted
        switch (key) {
            case 'push':
            case 'unshift':
                inserted = args
                break;
            case 'splice':
                inserted = args.splice(2)
                break;
            default:
                break;
        }
        observe(inserted)
        ob.deps.notify()         //Vue.set里面对数组操作调用的就是hack过后的方法
        return res
    }
})

class Observer {
    constructor(data) {
        this.deps = new Depend()
        def(data, "__ob__", this)
        if (Array.isArray(data)) {
            data.__proto__ = ArrayMethods      //对数组进行hack操作
            this.observeArray(data)
        }
        else {
            this.walk(data)
        }
    }
    walk(data) {
        Object.keys(data).forEach(key => {
            this.defineReactive(data, key)
        })
    }
    observeArray() {             //对数组进行hack操作
        for (let i = 0, l = data.length; i < l; i++) {
            this.observe(data[i])
        }
    }
    defineReactive(obj, key) {
        let childOb = observe(obj[key])     //如果是个object的话,我们要收集这个对象的依赖,给Vue.set用
        let dep = new Depend()
        let value = obj[key]
        Object.defineProperty(obj, key, {
            get() {
                if (Depend.target) {           //依赖收集
                    dep.depend(Depend.target)
                    childOb && childOb.deps.depend()
                }
                return value
            },
            set(newVal) {
                childOb = observe(newVal)
                value = newVal
                dep.notify()
            }
        })
    }
}

function observe(data) {
    if (typeof data != 'object') {  //普通类型
        return
    }
    let ob
    if (hasOwn(data, '__ob__')) {   //有__ob__这个属性,说明已经ob过了
        ob = data.__ob__
    } else {
        ob = new Observer(data)
    }
    return ob
}

function getExpr(expr) {

}

let queue = []
let pending = false
let flushing = false

function flushQueue() {
    while (queue.length > 0) {
        let watcher = queue.pop()
        watcher.run()
    }
    flushing = false
}
let taskStack = []

function flushCallbacks() {
    pending = false
    let copies = taskStack.slice()
    for (let i = 0; i < copies.length; i++) {
        copies[i]()
    }
}

function nextTick(fn) {
    let timerFunc = function (cb) {
        Promise.resolve().then(() => {
            cb()
        })
    }
    taskStack.push(fn)
    if (!pending) {
        pending = true
        timerFunc(flushCallbacks)
    }
}

function queueWatcher(watcher) {
    queue.push(watcher)
    if (!flushing) {        //这里的flushing控制只会触发flushQueue一次
        flushing = true
        nextTick(flushQueue)
    }
}

class Watcher {
    constructor(vm, fnOrExp, callback, options = {}) {
        this.get = typeof fnOrExp === 'string ' ? getExpr(fnOrExp) : fnOrExp
        this.deps = []
        this.vm = vm
        this.computed = this.dirty = options.computed
        this.value = options.computed ? null : this.getter()
        this.value = options.dirty
    }
    getter() {
        pushTarget(this)
        let value = this.get.call(this.vm)
        popTarget()
        return value
    }
    update() {
        if (this.computed) {
            this.dirty = true
        } else {
            //this.run()
            queueWatcher(this)
        }
    }
    run() {
        let value = this.getter()
        if (this.value !== value) {
            this.vlaue = value
        }
    }
    addDep(dep) {
        if (this.deps.indexOf(dep) < 0) {
            dep.addSub(this)
            this.deps.push(dep)
        }
    }
}

function initData(vm) {
    let data = vm.$options.data
    data = vm._data = typeof data === 'function' ? data() : data
    for (let key in data) {
        getProxy(vm, "_data", key)
    }
    observe(data)
}

Vue.prototype.$emit = function (name, ...args) {
    let events = this._events[name]
    let vm = this
    debugger
    events.forEach(event => {
        event.call(vm, ...args)
    })
}

//这个步骤的用处是跟data是一样的,都需要把它绑定到vm实例上去,这样的话当render.call(vm)的时候才能
//把正确的数据给传到render上面去
function initMethods(vm) {
    let methods = vm.$options.methods
    Object.keys(methods).forEach(key => {
        vm[key] = methods[key].bind(vm)
    })
}

function initState(vm) {
    if (vm.$options.data) {
        initData(vm)
    }
    if (vm.$options.methods) {
        initMethods(vm)
    }
}
//这步的作用是在当我们_c(div,{on:{'fn':fn}})的时候,这个
function initEvents(vm) {
    vm._events = Object.create(null)
    let listners = vm.$options._parentListenrs
    if (listners) {
        //把回调函数挂到当前vm的_events上面
        for (let name in listners) {
            let events = vm._events[name] || []
            events.push(listners[name])
            vm._events[name] = events
        }
    }

}
function initMixin(Vue) {
    Vue.prototype.init = function (options) {
        let vm = this
        if (options._isComponent) {
            let parentVnode = options.parentVnode
            let parentComponentOptions = parentVnode.componentOption
            let _parentListenrs = parentComponentOptions.listners
            let opts = vm.$options = Object.create(vm.constructor.options)
            opts._parentListenrs = _parentListenrs   //需要把组件vnode的事件给到实例vm的选项上
        } else {
            vm.$options = mergeOptions(this.constructor.options, options, vm)
        }
        initRender(vm)               //设置模板渲染函数,让render()之后能拿到vnode
        initEvents(vm)
        callHook('beforeCreate', vm)
        initState(vm)              //对数据进行监听
        callHook('created', vm)
        //测试
        // new Watcher(vm, function () {
        //     console.log("this is " + this.aa)
        // })
        if (vm.$options.el) {
            vm.$mount(vm.$options.el)
        }
    }
}
function createChildren(vnode, children) {
    if (!children) return
    if (Array.isArray(children)) {
        for (let i = 0, l = children.length; i < l; i++) {
            createElm(children[i], vnode.elm)
        }
    } else {
        createElm(children, vnode.elm)
    }
}
//组件在不同生命周期的时候对不同属性的处理,如果是createElm说明是第一次进入到组件中
//那么就去调用cbs.create的处理函数
//如果是patchVnode估计就会调用cbs.update里面的处理函数
let cbs = {}

function updateAttrs() {

}
attrs = {
    create: updateAttrs,
    update: updateAttrs
}

function updateDirectives(oldVnode, Vnode) {
    Vnode.data = Vnode.data || {}
    //给所有的指令放上def属性,也就是指令的定义
    if (oldVnode.data.directives || Vnode.data.directives) {
        let newDirs = Vnode.data.directives.map(dir => {
            let { key, value } = dir
            let def = Vnode.context.$options.directives[key]
            dir.def = def
            return dir
        })
        console.log(newDirs)
        //经过了上一步,我们拿到了所有的指令的定义,然后去调用并传入指令的参数
        newDirs.forEach(newDir => {
            if (newDir.def) {
                newDir.def.bind(Vnode.elm, newDir)
            }
        })
    }

}

directives = {
    create: updateDirectives,
    update: updateDirectives,
}
events = {
    create: function createEvents() { },
    update: function updateEvents() { }
}

let modules = [attrs, events, directives]
let hooks = ['create', 'update']

for (let i = 0, l = hooks.length; i < l; i++) {
    let hook = hooks[i]
    modules.forEach(modul => {
        cbs[hook] = cbs[hook] ? cbs[hook].concat(modul[hook]) : [modul[hook]]
    })
}

function createComponent(vnode, parent) {
    if (vnode.data && (hooks = vnode.data.hooks) && (i = hooks.i)) {
        i(vnode, parent)
        return true
    }
}

function createElm(vnode, parent, ref) {
    if (createComponent(vnode, parent)) {
        return
    }
    if (vnode.tag) {
        vnode.elm = document.createElement(vnode.tag)
    } else {
        vnode.elm = document.createTextNode(vnode.text)
    }
    createChildren(vnode, vnode.children)
    //insert
    console.log(vnode.context.$options.directives)
    if (vnode.data && vnode.data.domProps) {
        Object.keys(vnode.data.domProps).forEach(key => {
            vnode.elm[key] = vnode.data.domProps[key]
        })
    }
    if (vnode.data && vnode.data.on) {
        Object.keys(vnode.data.on).forEach(key => {
            vnode.elm.addEventListener(key, vnode.data.on[key])
        })
    }
    for (let i = 0; i < cbs.create.length; i++) {
        let fn = cbs.create[i]
        let EmptyNode = { tag: '', data: {} }
        fn(EmptyNode, vnode)
    }
    if (parent) {
        if (ref) {
            parent.insertBefore(vnode.elm, ref)
        } else {
            parent.appendChild(vnode.elm)
        }
    }
    return vnode.elm
}

function isSameNode(node1, node2) {
    return node1.tag === node2.tag && node1.key === node2.key
}

function createKeyToIdx(oldChild, oldStart, oldEnd) {
    let map = Object.create(null)
    for (let i = oldStart, key; i <= oldEnd; i++) {
        isDef(key = oldChild[i].key) && (map[key] = i)
    }
    return map
}

function updateChildren(parentElm, oldChild, children) {
    let oldStart = 0
    let newStart = 0
    let oldEnd = oldChild.length - 1
    let newEnd = children.length - 1
    let VnodeToMove
    let keyToIdx
    while (oldStart <= oldEnd && newStart <= newEnd) {
        if (isSameNode(oldChild[oldStart], children[newStart])) {
            patchVnode(oldChild[oldStart], children[newStart])
            oldStart++
            newStart++
        }
        else if (isSameNode(oldChild[oldEnd], children[newEnd])) {
            patchVnode(oldChild[oldEnd], children[newEnd])
            oldEnd--
            newEnd--
        }
        else if (isSameNode(oldChild[oldStart], children[newEnd])) {
            //把老开头移动到老尾巴后面去
            patchVnode(oldChild[oldEnd], children[newEnd])
            parentElm.insertBefore(oldChild[oldStart].elm, oldChild[oldEnd].elm.nextSibling)
            oldStart++
            newEnd--
        } else if (isSameNode(oldChild[oldEnd], children[newStart])) {
            //把老尾巴移到老开头前面去
            patchVnode(oldChild[oldEnd], children[newStart])
            parentElm.insertBefore(oldChild[oldEnd].elm, oldChild[oldStart].elm)
            oldStart++
            newEnd--
        } else {
            //4个方向都没找到,去新节点头尾中间去找一个跟老的头一样的节点,找到了就放到老头的后面
            if (!keyToIdx) {
                keyToIdx = createKeyToIdx(oldChild, oldStart, oldEnd)
            }
            let index = keyToIdx[newStart]
            VnodeToMove = isDef(index) ? children[index] : null
            if (isDef(VnodeToMove)) {     //找到了老头对应节点插入到老头前面去
                parentElm.insertBefore(vnode.elm, oldChild[oldStart])
            } else {
                createElm(children[newStart], parentElm, oldChild[oldStart].elm)
            }
            newStart++
        }
    }
    if (oldStart <= oldEnd) {
        //老节点要删掉
        removeVnodes(parentElm, oldChild, oldStart, oldEnd)
    }
    if (newStart <= newEnd) {
        //还剩下新的节点没加上去,暂时没ref,因为没看懂
        addVnode(parentElm, children, newStart, newEnd)
    }
}

function addVnode(parentElm, children, start, end) {
    for (let i = start; i <= end; i++) {
        createElm(children[i], parentElm)
    }
}

function removeVnodes(parentElm, children, start, end) {
    for (let i = start; i <= end; i++) {
        parentElm.removeChild(children[i].elm)
    }
}

//patchVnode->updateChildren->pathVnode
function patchVnode(oldVnode, vnode) {
    let elm = vnode.elm = oldVnode.elm
    let oldChild = oldVnode.children
    let children = vnode.children
    if (!isDef(vnode.text)) {
        if (isDef(oldChild) && isDef(children)) {
            updateChildren(elm, oldChild, children)
        } else if (children) {
            addVnodes(elm, children)
        } else if (oldChild) {
            remoreVnodes(elm, oldChild)
        }
    } else {
        if (oldVnode.text !== vnode.text) {
            elm.textContent = vnode.text
        }
    }
    if (vnode.data && vnode.data.domProps) {
        Object.keys(vnode.data.domProps).forEach(prop => {
            elm[prop] = vnode.data.domProps[prop]
        });
    }
}

Vue.prototype.__patch__ = function (oldVnode, vnode) {
    if (!oldVnode) {
        createElm(vnode)
    } else {
        //二者都存在
        if (isSameNode(oldVnode, vnode)) {
            patchVnode(oldVnode, vnode)       //更新diff算法
        } else {
            if (isDef(oldVnode.nodeType)) {
                createElm(vnode, oldVnode.parentNode, oldVnode)
            }
        }
    }
    return vnode.elm
}

Vue.prototype._update = function (vnode) {
    console.log(vnode)
    let vm = this
    let prevNode = vm._vnode
    vm._vnode = vnode
    if (!prevNode) {
        vm.$el = vm.__patch__(vm.$el, vnode)
        console.log(vm.$el)
    } else {
        vm.$el = vm.__patch__(prevNode, vnode)
    }
}

function mountComponent(vm, el) {
    callHook('beforeMount', vm)
    function updateComponet() {
        let render = vm.$options.render
        vm._update(render.call(vm))
    }
    new Watcher(vm, updateComponet)
    return vm.$el
}

var ncname = '[a-zA-Z_][\\w\\-\\.]*';   //这里的\\w是因为当我们去用字符串去new的时候,\也需要转义
//这里的意思是必须要大小写字母和_开头
var tagStart = /^<([a-zA-Z]\w*)/     //这里要注意的是如果要区分start和end,比如<div>和</div>,一定要主要用^大头,因为html的后面会有其他的开头和结尾
//如果不加的话就会匹配到后面的开头
var StartCloseTag = /^\s*(\/?)>/;
var enTag = /^<\/(\w+)>/
var delimmiter = /\{\{(\w+)\}\}/
var attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
var forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
var forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
var stripParensRE = /^\(|\)$/g;
var dirRe = /v-|^@|^:/
var modifierRE = /\.[^\.]+/g
var bindRE = /:|v-bind:/
var onRE = /@|v-on:/
var simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/;

var root
var currentParent
var stack = []   //stack的作用主要是用来当子标签闭合,获取当前的currentParent
function getASTElement(tag, attrsList, attrsMap, unary) {
    return {
        tag,
        attrsList,
        attrsMap: attrsMap,
        unary,
        parent,
        children: []
    }
}
let match

function getAttrMap(attrs) {
    let res = {}
    for (let i = 0, l = attrs.length; i < l; i++) {
        res[attrs[i].key] = attrs[i].value
    }
    return res
}

function getAndRemoveAttr(el, key) {
    delete el.attrsMap[key]
    let res = []
    for (let i = 0; i < el.attrsList.length; i++) {
        if (el.attrsList[i].key !== key) {
            res.push(el.attrsList[i])
        }
    }
    el.attrsList = res
}

function processFor(element) {
    let keys = Object.keys(element.attrsMap)
    let expr
    for (let i = 0, l = keys.length; i < l; i++) {
        let key = keys[i]
        if (key === 'v-for') {
            expr = element.attrsMap[key].replaceAll("'", "").replaceAll('"', "")
            //todo
            getAndRemoveAttr(element, key)
            break
        }
    }
    if (expr) {
        let forMatch = expr.match(forAliasRE)
        element.for = forMatch[2]
        let alias = forMatch[1]
        element.alias = alias = alias.replace(stripParensRE, "")
        //a,b
        let iterMatch = alias.match(forIteratorRE)
        if (iterMatch) {
            element.alias = alias.replace(forIteratorRE, "").trim()
            element.iter1 = iterMatch[1].trim()
        }
    }
}

function addIfConditions(ast, condition) {
    if (!ast.ifConditions) {
        ast.ifConditions = []
    }
    ast.ifConditions.push(condition)
}

// function addIfConditions(ast) {
//     if (ast.elseif || ast.else) {
//         let prev = findPrev()
//         prev.ifConditions = prev.ifConditions || []
//         prev.ifConditions.push({
//             expr: ast.elseif || ast.else,
//             block: ast
//         })
//     } else {
//         ast.ifConditions.push({
//             expr: ast.if,
//             block: ast
//         })
//     }
// }

function processIf(element) {
    let expr
    let attrsMap = element.attrsMap
    let ifConditions = element.ifConditions
    Object.keys(attrsMap).forEach(key => {
        if (key === 'v-if') {
            expr = attrsMap[key]
            element.ifConditions = ifConditions ? element.ifConditions : []
            element.if = expr
            getAndRemoveAttr(element, key)
        } else if (key === 'v-else-if') {
            expr = attrsMap[key]
            element.elseif = expr
            getAndRemoveAttr(element, key)
        } else if (key === 'v-else') {
            element.else = true
            getAndRemoveAttr(element, key)
        }
    })
}

function parseHTML(html, options = {}) {
    let stack = []
    html = html.trim()
    function advance(len) {
        html = html.substring(len)    //这个html很巧妙,在闭包里面
    }
    function parseStart() {
        let startMatch = html.match(tagStart)
        if (startMatch) {
            let tag = startMatch[1]
            advance(startMatch[0].length)
            let attr, end, attrs = []
            while (!(end = html.match(StartCloseTag)) && (attr = html.match(attribute))) {
                attrs.push(attr)
                advance(attr[0].length)
            }
            let match = {
                tag,
                attrs
            }
            if (end) {
                advance(end[0].length)
                match.unaryTag = end[1]
            }
            return match
        }
    }
    let unaryTag = 'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
        'link,meta,param,source,track,wbr'

    function handleStart(match) {
        let tagName = match.tag
        let attrs = match.attrs
        let attrsList = []
        for (let i = 0, l = attrs.length; i < l; i++) {
            let attr = attrs[i]
            let key = attr[1]
            let value = attr[3] || attr[4] || attr[5]
            attrsList.push({ key, value })
        }
        let unary = unaryTag.split(",").indexOf(tagName) > -1 || !!match.unaryTag
        if (!unary) {
            stack.push({
                tag: tagName,
                lowerCaseTag: tagName.toLowerCase()
            })
        }
        options.start(tagName, attrsList, unary)
    }

    function parseEnd(match) {
        let tag = match[1]
        let pos
        for (let i = stack.length - 1; i >= 0; i--) {
            let lowerCaseTag = stack[i].lowerCaseTag
            if (tag.toLowerCase() === lowerCaseTag) {
                pos = i
                break
            }
        }
        if (pos >= 0) {
            for (let i = stack.length - 1; i >= pos; i--) {
                if (pos > i) {
                    console.warn("no endTag for" + stack[i].tag)
                    options.end()
                } else {
                    options.end()
                }
            }
            stack = stack.slice(0, pos)
        }
        else {
            if (tag === 'br') {
                options.start(tag, [], true)
            }
            if (tag === 'p') {
                options.start(tag, [], false)
                options.end()
            }
        }
    }

    while (html) {
        let index = html.indexOf("<")
        if (index === 0) {
            let startMatch = parseStart()
            if (startMatch) {
                handleStart(startMatch)
                continue
            }
            //endTag  </div>
            if (match = html.match(enTag)) {
                parseEnd(match)
                //options.end()
                advance(match[0].length)
                continue
            }
        }
        //处理文本节点
        let text = html.substring(0, index)
        if (text.trim().length > 0) {
            options.chars(text)
        }
        advance(text.length)
    }
    return root
}

function getChildren(children) {
    if (children.length === 1 && children[0].for) {
        //这里是一个需要注意的点,这里如果发现ast上面有for的话,那么就不能外面再包一层'[]',因为如果是[_l(....)]就不对了
        //_l返回的本来就是一个数组
        let child = children[0]
        if (child.tag) {
            //是一个html节点
            return getElement(child)
        } else {
            //是一个str文字
            return genNode(child)
        }
    }
    let str = children.map(child => {
        if (child.tag) {
            //是一个html节点
            return getElement(child)
        } else {
            //是一个str文字
            return genNode(child)
        }
    })
    return `[${str.join(",")}]`
}

//_c('div', [  _c('p', [_v(_s(aa))])   , _c('span', [_v(_s(bb))] )   ])

function genFor(element) {
    element.forProcessed = true
    //这里需要把v-for拼装成一个_l(res,callback)的这样的一个形式,这样的话,在_l中就看可以通过for循环来_c拿到vnode,
    return `_l(${element.for},function(${element.alias},${element.iter1}){return ${getElement(element)}})`
}

function genIf(ast) {
    let ifConditions = ast.ifConditions
    if (ifConditions.length === 0) {
        return '_e()'
    }
    let condition = ifConditions.shift()
    let node = condition.block
    node.ifProcessed = true
    let res = `${condition.expr} ? ${genNode(node)}: ${genIf(ast)}`
    console.log(res)
    return res
}

function addProp(el, key, value) {
    if (!el.props) {
        el.props = []
    }
    el.props.push({
        key, value
    })
}

function addHandler(el, eventName, code) {
    let events = el.events || (el.events = {})
    events[eventName] = code       //暂时不考虑数组的情况了
    el.events = events
}
function model(el, dir) {
    function genAssignmentCode(value, assign) {
        return value += "=" + assign
    }
    //生成一个model的处理函数
    let modifiers = dir.modifiers || {}
    let event = modifiers.lazy ? "change" : "input"
    addProp(el, "value", dir.value)
    let code = genAssignmentCode(dir.value, "$event.target.value")
    addHandler(el, event, code)

}


function genDirective(el, state) {
    let directives = el.dirs
    if (!directives) {
        return ""
    }
    let res = "directives: ["
    let flag = false
    for (let i = 0; i < directives.length; i++) {
        let dir = directives[i]
        let key = dir.key
        let gen = state[key]
        if (gen) {
            gen(el, dir)
        } else {
            res += `{key:'${dir.key}',value:${dir.value},modifiers:${JSON.stringify(dir.modifiers)}}`
        }
    }
    if (flag) {
        res.slice(0, res.length - 1)
    }
    return res + "]"
}
function genData(el, state) {
    let data = "{"
    let dirs = genDirective(el, state)
    if (dirs) {
        data += (dirs + ",")
    }
    if (el.props) {
        let props = el.props.reduce((res, prop) => {
            return res += `${prop.key}:${prop.value},`
        }, "")
        data += "domProps:{" + props.slice(0, props.length - 1) + "},"
    }
    if (el.events) {
        let res = ""
        //对于每个事件种类,如input.click等
        Object.keys(el.events).forEach(key => {
            let handler = el.events[key]
            if (simplePathRE.test(handler)) {
                handler = handler      //如果是一个函数名字的话就直接返回
            } else {
                handler = "function($event){" + el.events[key] + "}"
            }
            res += (key + ":" + handler)
        })
        data += "on:{" + res + "},"
    }
    data += "}"
    console.log(data)
    return data
}

function getElement(ast) {
    let str
    if (ast.for && !ast.forProcessed) {
        str = genFor(ast)
    }
    else if (ast.if && !ast.ifProcessed) {
        str = genIf(ast)
    }
    else {
        let data = genData(ast, { model: model })
        str = `_c('${ast.tag}'${data ? ',' + data : ''} ${ast.children ? ',' + getChildren(ast.children) : ''})`
    }
    return str
}

function getText(ast) {
    return `_v(_s(${ast.expr}))`
}
function genNode(ast) {
    if (ast.type === 1) {
        return getElement(ast)
    } else if (ast.type === 2) {
        return getText(ast)
    } else if (ast.type === 3) {
        return `_v(_s('${ast.expr}'))`
    }
}

function generate(ast) {
    let fn = `with(this){
        return ${genNode(ast)}
    }`
    console.log(fn)
    return new Function(fn)
}

function findPrev() {
    let parent = currentParent
    console.log(parent)
    let index = parent.children.length - 1
    //这里直接找前一个就能找到if的那个,因为中间隔着的v-else的都没放到children里面
    return parent.children[index]
}

function addDirective(ast, key, value, modifiers) {
    let dirs = ast.dirs || (ast.dirs = [])
    dirs.push({
        key,
        value,
        modifiers
    })
    ast.dirs = dirs
}

function processAttrs(ast) {
    let attrs = ast.attrsList
    for (let i = 0, l = attrs.length; i < l; i++) {
        let attr = attrs[i]
        let key = attr.key
        let modifiers = {}
        let modifierMath = key.match(modifierRE)
        if (modifierMath) {
            key = key.replace(modifierRE, "")
            modifierMath.forEach(modifier => {
                modifiers[modifier.slice(1)] = true    //把modifier的.给去掉
            })
        }
        let value = attr.value
        //这里要分情况讨论,attr的情况比较多,可能是属性,可能是事件,可能是指令
        if (dirRe.test(key)) {
            if (bindRE.test(key)) {
                //1.可能是prop (匹配v-bind:或者:的情况)
                key = key.replace(bindRE, "")
                addProp(el, key, value)
            } else if (onRE.test(key)) {
                //1.可能是handlers v-on:或者@的情况
                let event = key.replace(onRE, "")
                addHandler(ast, event, value)
            } else {
                //normal Directives
                //常规指令,v-model,v-html等等
                key = key.replace(dirRe, "")
                addDirective(ast, key, value, modifiers)
            }
        }
    }
}

function processElement(ast) {
    processAttrs(ast)
}
Vue.prototype.$mount = function (el) {
    let vm = this
    root = null
    vm.$el = document.querySelector(el)
    if (vm.$options.render) {
        return mountComponent(vm, el)
    }
    var ast = parseHTML(vm.$options.template, {
        start(tag, attrsList, unary) {
            let attrsMap = getAttrMap(attrsList)
            let ast = getASTElement(tag, attrsList, attrsMap, unary)
            ast.type = 1
            processFor(ast)
            processIf(ast)
            processElement(ast)    //processAttrs->将attrs分别放入el.props,el.handlers,el.directives
            if (!root) {
                root = ast
            }
            if (currentParent) {
                if (ast.if) {
                    addIfConditions(ast, {
                        expr: ast.if,
                        block: ast
                    })
                }
                if (ast.elseif || ast.else) {
                    let prev = findPrev()
                    addIfConditions(prev, {
                        expr: ast.elseif || ast.else,
                        block: ast
                    })
                } else {
                    //如果不存在else,和elseif那么才把它放到children里面去
                    //这样方便获取prev然后获取ifconditions
                    currentParent.children.push(ast)
                    ast.parent = currentParent
                }
            }
            if (!unary) {
                //如果是一元标签,那么就不会成为父亲,并且也不会走到parseEnd里头去,因为正则不会匹配到</..>
                currentParent = ast
                stack.push(ast)
            }
        },
        end() {
            stack.pop()
            currentParent = stack[stack.length - 1]    //<div><p></p><p></p></div>,把第一个p闭合父亲回到外层div
        },
        chars(text) {
            if (match = text.match(delimmiter)) {
                currentParent && currentParent.children.push({
                    expr: `${match[1]}`,
                    test: match[0],
                    type: 2
                })
            } else {
                currentParent && currentParent.children.push({
                    expr: text,
                    test: text,
                    type: 3
                })
            }
        }
    })
    vm.$options.render = generate(ast)
    return mountComponent(vm, el)
}

Vue.options = Object.create(null)
Vue.config = Object.create(null)

Vue.config.mergeOptionsStrategies = Object.create(null)

let strats = Vue.config.mergeOptionsStrategies

const ASSETS_TYPE = ['component', 'directive']

ASSETS_TYPE.forEach((asset) => {
    Vue.options[asset + "s"] = Object.create(null)
})


ASSETS_TYPE.forEach((asset) => {
    //静态函数,组件挂载
    if (asset === 'component') {
        Vue[asset] = function (id, definition) {
            let ctor = this.options._base.extend(definition)   //this.options._base就是Vue
            this.options[asset + "s"][id] = ctor
        }
    }
})

var show = {
    bind(el, ref) {
        let value = ref.value
        let originDisplay = el.style.display
        el.style.display = value ? originDisplay : 'none'
    },
    update() {

    }
}

platFormDirectives = {
    show: show
}

//把自带的给extend上去,这样

function extend(to, from) {
    for (let key in from) {
        to[key] = from[key]
    }
}
extend(Vue.options.directives, platFormDirectives)

function mergeHook(parVal, childVal) {
    if (!parVal) {
        parVal = []
    }
    if (Array.isArray(childVal)) {
        parVal = parVal.concat(childVal)
    } else {
        childVal && (parVal = [...parVal, childVal])
    }
    return parVal
}
//生命周期策略
const lifeCycles = ["beforeCreate", "created", "beforeMount", "mounted"]

lifeCycles.forEach(cycle => {
    strats[cycle] = mergeHook
})

function callHook(hook, vm) {
    const handlers = vm.$options[hook]
    if (handlers) {
        for (var i = 0, l = handlers.length; i < l; i++) {
            handlers[i].call(vm)
        }
    }
}

function Vue(options) {
    this.init(options)
}

initMixin(Vue)

Vue.options._base = Vue

Vue.extend = function (extendedOptions = {}) {
    //通过组合继承的方式继承父类
    let Super = this
    let Sub = function (options) {
        this.init(options)
    }
    Sub.options = mergeOptions(Super.options, extendedOptions)
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    ASSETS_TYPE.forEach(asset => {
        //给静态方法
        Sub[asset] = Super[asset]
    })
    Sub.mixin = Super
    return Sub
}