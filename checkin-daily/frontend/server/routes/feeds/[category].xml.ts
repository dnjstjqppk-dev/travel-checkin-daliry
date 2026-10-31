import { defineEventHandler, getRouterParam } from 'h3'
import { newsFeed } from '../../utils/news-feed'
export default defineEventHandler(event => newsFeed(event, 'rss', getRouterParam(event, 'category')))
