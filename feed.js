'use strict';

const Parser = require('rss-parser');
const api = require('./api');

const parser = new Parser();

let startDate = null;
let endDate = null;

let action = null;
let page = null;
let pageSize = null;

module.exports = async function (activity) {
  try {
    api.initialize(activity);

    const response = await api('/');

    const parsed = await parser.parseString(response.body);

    const items = [];

    configureRange();

    for (let i = 0; i < parsed.items.length; i++) {
      const item = convertItem(parsed.items[i]);

      if (!skip(i, parsed.items.length, new Date(item.date))) items.push(item);
    }

    activity.Response.Data._startDate = startDate;
    activity.Response.Data._endDate = endDate;
    activity.Response.Data._action = action;
    activity.Response.Data._page = page;
    activity.Response.Data._pageSize = pageSize;

    activity.Response.Data.items = items;
  } catch (error) {
    let m = error.message;

    if (error.stack) m = m + ': ' + error.stack;

    activity.Response.ErrorCode = (error.response && error.response.statusCode) || 500;

    activity.Response.Data = {
      ErrorText: m
    };
  }

  function configureRange() {
    if (activity.Request.Query.startDate) startDate = convertDate(activity.Request.Query.startDate);
    if (activity.Request.Query.endDate) endDate = convertDate(activity.Request.Query.endDate);

    if (!startDate && !endDate && activity.Request.Query.page && activity.Request.Query.pageSize) {
      action = 'firstpage';

      page = parseInt(activity.Request.Query.page, 10);
      pageSize = parseInt(activity.Request.Query.pageSize, 10);

      if (
        activity.Request.Data &&
        activity.Request.Data.args &&
        activity.Request.Data.args.atAgentAction === 'nextpage'
      ) {
        action = 'nextpage';

        page = parseInt(activity.Request.Data.args._page, 10) || 2;
        pageSize = parseInt(activity.Request.Data.args._pageSize, 10) || 20;
      }
    }
  }

  function convertDate(date) {
    return new Date(
      date.substring(0, 4),
      date.substring(4, 6) - 1,
      date.substring(6, 8)
    );
  }

  function skip(i, length, date) {
    if (startDate && endDate) {
      if (date < startDate || date > endDate) return true;
    } else if (startDate) {
      if (date < startDate) return true;
    } else if (endDate) {
      if (date > endDate) return true;
    } else if (page && pageSize) {
      const startItem = Math.max(page - 1, 0) * pageSize;

      let endItem = startItem + pageSize;

      if (endItem > length) endItem = length;

      if (i < startItem || i >= endItem) return true;
    } else {
      return false;
    }
  }

  function convertItem(raw) {
    const item = {};

    if (raw.guid) {
      item.id = raw.guid;
      item.guid = raw.guid;
    } else if (raw.link) {
      item.id = raw.link;
    }

    if (raw.title) item.title = raw.title;

    if (raw.description) {
      item.description = raw.description;
    } else if (raw.content) {
      item.description = raw.content;
    }

    if (raw.link) item.link = raw.link;

    if (raw.isoDate) {
      item.date = raw.isoDate;
    } else if (raw.pubDate) {
      item.date = raw.pubDate.toISOString();
      item.pubDate = raw.pubDate;
    }

    if (raw.author) {
      item.author = raw.author;
    } else if (raw.creator) {
      item.author = raw.creator;
    }

    item._raw = raw;

    return item;
  }
};
