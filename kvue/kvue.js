function defineReactive(obj, key, val) {
  // 递归
  observe(val);

  // Dep在这创建
  const dep = new Dep()
  
  Object.defineProperty(obj, key, {
    get() {
			// 依赖收集
      Dep.target && dep.addDep(Dep.target)
      return val;
    },
    set(v) {
      if (val !== v) {
        console.log("set", key);
        // 传入新值v可能还是对象
        observe(v);  // obj.aa={a:10}
        val = v;

        dep.notify()
      }
    },
  });
}

// 递归遍历obj，动态拦截obj的所有key
function observe(obj) {
  if (typeof obj !== "object" || obj == null) {
    return obj;
  }

  // 每出现一个对象，创建一个Ob实例
  new Observer(obj);
}

// Observer: 判断传入obj类型，做对应的响应式处理
class Observer {
  constructor(obj) {
    this.value = obj;

    // 判断对象类型
    if (Array.isArray(obj)) {
      // todo
    } else {
      this.walk(obj);
    }
  }

  // 对象响应式
  walk(obj) {
    Object.keys(obj).forEach((key) => {
      defineReactive(obj, key, obj[key]);
    });
  }
}

function proxy(vm) {
  Object.keys(vm.$data).forEach((key) => {
    Object.defineProperty(vm, key, {
      get() {
        return vm.$data[key];
      },
      set(v) {
        vm.$data[key] = v;
      },
    });
  });
}

class KVue {
  constructor(options) {
    // 保存选项
    this.$options = options;
    this.$data = options.data;
    this.$methods = options.methods;

    // 2.响应式处理
    observe(this.$data);

    // 3.代理data到KVue实例上
    proxy(this);

    // 4.编译
    new Compile(options.el, this);
  }
}

class Compile {
  // el-宿主，vm-KVue实例
  constructor(el, vm) {
    this.$vm = vm;
    this.$el = document.querySelector(el);

    this.compile(this.$el);
  }

  compile(el) {
    // 遍历el dom树
    el.childNodes.forEach((node) => {
      if (this.isElement(node)) {  // 判断是否是元素
        // element
        // 需要处理属性和子节点
        // console.log("编译元素", node.nodeName);
        this.compileElement(node);

        // 递归子节点
        if (node.childNodes && node.childNodes.length > 0) {
          this.compile(node);
				}
      } else if (this.isInter(node)) {  // 判断是否是元素
        // console.log("编译插值表达式", node.textContent);
        // 获取表达式的值并赋值给node
        this.compileText(node);
      }
    });
	}
	
	// 表示节点是元素，元素代表值是1
  isElement(node) {
    return node.nodeType === 1;
  }

	// {{xxx}}
	// 文本是代表是是3
  isInter(node) {
    return node.nodeType === 3 && /\{\{(.*)\}\}/.test(node.textContent);
  }

  isDir(attr) {
    return attr.startsWith("k-");
	}
	
	isAt(attr) {
    return attr.startsWith("@");
  }
  
  
  // 编译文本，将{{ooxx}}
  compileText(node) {
    this.update(node, RegExp.$1, 'text')
  }

  
  
  // 处理元素所有动态属性
  compileElement(node) {
    Array.from(node.attributes).forEach((attr) => {
      const attrName = attr.name;
      const exp = attr.value;

      // 判断是否是一个指令
      if (this.isDir(attrName)) {
        // 执行指令处理函数
        // k-text, 关心text
        const dir = attrName.substring(2);
				this[dir] && this[dir](node, exp)
				// 判断是否是@开始
			}else if(this.isAt(attrName)) {
				const dir = attrName.substring(1);
				this[dir] && this[dir](node, exp)
			}
    });
	}
	
	// 更新函数，
  update(node, exp, dir) {
    // init
    const fn = this[dir + 'Updater']
    fn && fn(node, this.$vm[exp])

    // update: 创建Watcher
    new Watcher(this.$vm, exp, (val) => {
      fn && fn(node, val)
    })
	}
	
	// @click,因为没有依赖，所以直接监听点击事件即可
	click(node, exp) {
		node.addEventListener("click", (event) => {
			this.$vm.$methods[exp]()
		})
	}

	// @input,因为没有依赖，所以直接监听输入即可
	input(node, exp) {
		node.addEventListener("input", event => this.$vm.$methods[exp]())
	}

  // k-text处理函数
  text(node, exp) {
    this.update(node, exp, 'text')
  }

  // k-html
  html(node, exp) {
    this.update(node, exp, 'html')
	}
	
	// k-model
	model(node, exp) {
		// 由于modelUpdater有this指向的问题，所以在这里赋值
		node.addEventListener("input", event => this.$vm.$options.data[exp] = event.target.value)
    this.update(node, exp, 'model')
	}

	textUpdater(node, val) {
    node.textContent = val
  }

  htmlUpdater(node, val) {
    node.innerHTML = val
	}
	
	modelUpdater(node, val) {
		node.value = val
	}

	clickUpdater(node, val) {
	}
}

// 小秘书：做dom更新
class Watcher {
  constructor(vm, key, updateFn) {
    this.vm = vm
    this.key = key
		this.updateFn = updateFn

    // 读取一下key的值，触发其get，从而收集依赖
		Dep.target = this
    this.vm[this.key]
    Dep.target = null
  }

  update() {
    this.updateFn.call(this.vm, this.vm[this.key])
  }
}

// 依赖：和响应式对象的每个key一一对应
class Dep {
  constructor() {
    this.deps = []
  }

  addDep(dep) {
    this.deps.push(dep)
  }

  notify() {
    this.deps.forEach(dep => dep.update())
  }
}