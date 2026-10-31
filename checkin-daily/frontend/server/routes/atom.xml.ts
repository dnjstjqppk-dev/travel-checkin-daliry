import { defineEventHandler } from 'h3'
import { newsFeed } from '../utils/news-feed'
export default defineEventHandler(event => newsFeed(event, 'atom'))
