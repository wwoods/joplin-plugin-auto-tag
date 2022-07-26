import joplin from 'api';

const pluginName = 'io.github.wwoods.JoplinPluginAutoTag';

joplin.plugins.register({
	onStart: async function() {
		console.info('Auto Tag plugin started!');

    await joplin.settings.registerSection(pluginName, {
      label: 'Auto Tag',
      iconName: 'fas fa-heartbeat',
    });

    // Load tags
    let tagId;
    for await (const tag of paginatedData(['tags'])) {
      if (tag.title === 'todo/urgent') {
        tagId = tag.id;
        break;
      }
    }
    if (tagId === undefined) {
      const r = await joplin.data.post(['tags'], null, {
        title: 'todo/urgent',
      });
      tagId = r.id;
    }

    let lastUpdated: string;
    const loaderFields = ['id', 'title', 'body', 'parent_id', 'updated_time',
        'is_todo'];
    while (true) {
      let loader;
      if (lastUpdated === undefined) {
        loader = paginatedData(['notes'], {fields: loaderFields});
      }
      else {
        loader = paginatedData(['search'], {
          query: `updated:${lastUpdated}`,
          fields: loaderFields,
        });
      }
      lastUpdated = dateToFormat(new Date());

      const promises = [];
      for await (const n of loader) {
        promises.push(tagNote(n, tagId));
      }
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
	},
});


function dateToFormat(d: Date) {
    const nowyyyy = d.getFullYear();
    let nowmm: number|string = d.getMonth() + 1;
    if (nowmm < 10) nowmm = '0' + nowmm;
    let nowdd: number|string = d.getDate();
    if (nowdd < 10) nowdd = '0' + nowdd;
    return `${nowyyyy}${nowmm}${nowdd}`;
}


async function* paginatedData(path, query=undefined) {
  if (query === undefined) query = {};
  query = Object.assign({}, query);

  let page: number = 1;
  while (true) {
    const r = await joplin.data.get(path, query);
    for (const i of r.items) {
      yield i;
    }
    if (!r.has_more) break;

    page += 1;
    query.page = page;
  }
}


async function tagNote(n: any, tagId: number) {
  // Any title matching e.g. 'd2022-01-22 ' will be converted
  if (!/^d\d+-\d+-\d+ /.test(n.title)) {
    return;
  }

  if (!n.is_todo) {
    // Convert to a todo
    await joplin.data.put(['notes', `${n.id}`], null, {
      is_todo: true,
    });
  }

  // Ensure tagged
  let sawTag = false;
  for await (const tag of paginatedData(['notes', `${n.id}`, 'tags'])) {
    if (tag.id === tagId) {
      sawTag = true;
      break;
    }
  }
  if (!sawTag) {
    await joplin.data.post(['tags', `${tagId}`, 'notes'], null, {
      id: n.id,
    });
  }
}

