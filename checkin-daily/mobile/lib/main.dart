import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://travel-checkin-daily.dnjstjqppk.workers.dev',
);

final dioProvider = Provider<Dio>((ref) => Dio(BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
    )));

// Theme Mode Provider
final isDarkModeProvider = StateProvider<bool>((ref) => false);

// Language Provider
final currentLangProvider = StateProvider<String>((ref) => 'ko');

// Navigation Tab Provider
final currentNavTabProvider = StateProvider<int>((ref) => 0);

// Category Provider
final selectedCategoryProvider = StateProvider<String>((ref) => '');

// Bookmarks Provider
final bookmarkedArticlesProvider = StateNotifierProvider<BookmarkNotifier, Set<String>>((ref) {
  return BookmarkNotifier();
});

class BookmarkNotifier extends StateNotifier<Set<String>> {
  BookmarkNotifier() : super({});

  void toggle(String slug) {
    if (state.contains(slug)) {
      state = Set.from(state)..remove(slug);
    } else {
      state = Set.from(state)..add(slug);
    }
  }

  bool isBookmarked(String slug) => state.contains(slug);
}

// Articles List Provider
final articlesProvider = FutureProvider<List<Article>>((ref) async {
  final category = ref.watch(selectedCategoryProvider);
  final lang = ref.watch(currentLangProvider);
  try {
    final queryParams = <String, dynamic>{};
    if (category.isNotEmpty) queryParams['category'] = category;
    if (lang != 'ko') queryParams['lang'] = lang;
    final response = await ref.watch(dioProvider).get<dynamic>(
          '/api/articles',
          queryParameters: queryParams.isEmpty ? null : queryParams,
        );
    final data = response.data;
    if (data is List) {
      return data.map((json) => Article.fromJson(json as Map<String, dynamic>)).toList();
    } else if (data is Map && data['articles'] is List) {
      return (data['articles'] as List)
          .map((json) => Article.fromJson(json as Map<String, dynamic>))
          .toList();
    }
    return [];
  } catch (_) {
    // Return sample fallback articles if backend is offline in local preview
    return [
      Article(
        id: 57,
        slug: 'bangkok-suvarnabhumi-sat-1-terminal-expansion',
        title: '방콕 수완나품 공항 신규 위성터미널(SAT-1) 전면 가동… 입국 심사 20분대 단축',
        summary: '태국 방콕 수완나품 국제공항이 제1위성터미널(SAT-1)과 무인 지하 셔틀트레인(APM)을 전면 가동하며 연간 여객 수용 능력을 6,000만 명으로 확대했습니다.',
        content: '태국공항공사(AOT)는 수완나품 국제공항의 신규 제1위성터미널(SAT-1)을 전면 개방했습니다. 자동출입국 게이트 32대가 신설되었습니다.',
        category: 'destination',
        author: '체크인데일리 방콕지국',
        coverImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80',
        publishedAt: '2026-10-14',
      ),
      Article(
        id: 58,
        slug: 'thai-airways-bangkok-chiangmai-daily-10-flights',
        title: '타이항공, 동계 시즌 방콕~치앙마이 일 10회 증편… 북부 러이끄라통 축제 특수',
        summary: '타이항공이 11월 동계 시즌과 북부 최대 축제인 러이끄라통 기간에 맞추어 주력 노선을 대폭 증편합니다.',
        content: '타이항공은 방콕 수완나품~치앙마이 노선에 A350-900 광동체기를 투입하여 관광객 편의를 극대화합니다.',
        category: 'airline',
        author: '체크인데일리 항공운송팀',
        coverImage: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80',
        publishedAt: '2026-10-14',
      ),
    ];
  }
});

class Article {
  const Article({
    required this.id,
    required this.title,
    required this.summary,
    required this.content,
    required this.category,
    required this.author,
    required this.slug,
    this.coverImage = '',
    this.publishedAt = '',
  });

  final int id;
  final String title;
  final String summary;
  final String content;
  final String category;
  final String author;
  final String slug;
  final String coverImage;
  final String publishedAt;

  factory Article.fromJson(Map<String, dynamic> json) => Article(
        id: json['id'] as int? ?? 0,
        title: json['title'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        content: json['content'] as String? ?? '',
        category: json['category'] as String? ?? '',
        author: json['author'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        coverImage: json['coverImage'] as String? ?? '',
        publishedAt: json['publishedAt'] as String? ?? '',
      );
}

void main() => runApp(const ProviderScope(child: CheckinDailyApp()));

class CheckinDailyApp extends ConsumerWidget {
  const CheckinDailyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = ref.watch(isDarkModeProvider);

    return MaterialApp(
      title: 'Check-in Daily',
      debugShowCheckedModeBanner: false,
      themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF176B52),
          brightness: Brightness.light,
          primary: const Color(0xFF176B52),
        ),
        scaffoldBackgroundColor: const Color(0xFFF7F8F7),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF176B52),
          brightness: Brightness.dark,
          primary: const Color(0xFF45A686),
        ),
        scaffoldBackgroundColor: const Color(0xFF121413),
        useMaterial3: true,
      ),
      home: const MainNavigationShell(),
    );
  }
}

class MainNavigationShell extends ConsumerWidget {
  const MainNavigationShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTab = ref.watch(currentNavTabProvider);

    final screens = const [
      NewsFeedScreen(),
      SearchNewsScreen(),
      BookmarksScreen(),
      ReporterPortalScreen(),
    ];

    return Scaffold(
      body: IndexedStack(
        index: selectedTab,
        children: screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedTab,
        onDestinationSelected: (index) => ref.read(currentNavTabProvider.notifier).state = index,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.newspaper_outlined), selectedIcon: Icon(Icons.newspaper), label: '뉴스'),
          NavigationDestination(icon: Icon(Icons.search_outlined), selectedIcon: Icon(Icons.search), label: '검색'),
          NavigationDestination(icon: Icon(Icons.bookmark_outline), selectedIcon: Icon(Icons.bookmark), label: '스크랩'),
          NavigationDestination(icon: Icon(Icons.edit_note_outlined), selectedIcon: Icon(Icons.edit_note), label: '기자실'),
        ],
      ),
    );
  }
}

class NewsFeedScreen extends ConsumerWidget {
  const NewsFeedScreen({super.key});

  static const categories = {
    '': '전체',
    'major': '주요뉴스',
    'airline': '항공',
    'hotel': '호텔',
    'destination': '여행지',
    'realtime': '실시간',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(selectedCategoryProvider);
    final articlesAsync = ref.watch(articlesProvider);
    final isDark = ref.watch(isDarkModeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xFF176B52), borderRadius: BorderRadius.circular(4)),
              child: const Text('CHECK-IN', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 1.0)),
            ),
            const SizedBox(width: 6),
            const Text('DAILY', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode),
            onPressed: () => ref.read(isDarkModeProvider.notifier).state = !isDark,
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.language),
            onSelected: (lang) => ref.read(currentLangProvider.notifier).state = lang,
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'ko', child: Text('한국어 (KO)')),
              PopupMenuItem(value: 'en', child: Text('English (EN)')),
              PopupMenuItem(value: 'zh', child: Text('中文 (ZH)')),
              PopupMenuItem(value: 'th', child: Text('ไทย (TH)')),
              PopupMenuItem(value: 'vi', child: Text('Tiếng Việt (VI)')),
              PopupMenuItem(value: 'es', child: Text('Español (ES)')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(articlesProvider.future),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: categories.entries.map((entry) {
                          final isSelected = selected == entry.key;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(entry.value),
                              selected: isSelected,
                              onSelected: (_) => ref.read(selectedCategoryProvider.notifier).state = entry.key,
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            articlesAsync.when(
              loading: () => const SliverFillRemaining(child: Center(child: CircularProgressIndicator())),
              error: (err, _) => SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cloud_off_outlined, size: 48, color: Colors.grey),
                        const SizedBox(height: 12),
                        const Text(
                          '뉴스 기사를 불러오는 중 일시적인 네트워크 지연이 발생했습니다.\n인터넷 연결 상태를 확인 후 다시 시도해 주세요.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 14, color: Colors.grey),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () => ref.refresh(articlesProvider.future),
                          icon: const Icon(Icons.refresh),
                          label: const Text('다시 시도'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const SliverFillRemaining(child: Center(child: Text('해당 분야 기사가 없습니다.')));
                }
                return SliverList.builder(
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    final article = items[index];
                    return ArticleCard(article: article);
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class ArticleCard extends ConsumerWidget {
  const ArticleCard({super.key, required this.article});

  final Article article;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookmarks = ref.watch(bookmarkedArticlesProvider);
    final isBookmarked = bookmarks.contains(article.slug);

    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ArticleDetailScreen(article: article)),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (article.coverImage.isNotEmpty) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  article.coverImage,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                ),
              ),
              const SizedBox(height: 10),
            ],
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  article.category.toUpperCase(),
                  style: const TextStyle(color: Color(0xFF176B52), fontWeight: FontWeight.bold, fontSize: 11),
                ),
                IconButton(
                  icon: Icon(isBookmarked ? Icons.bookmark : Icons.bookmark_border, size: 20),
                  onPressed: () => ref.read(bookmarkedArticlesProvider.notifier).toggle(article.slug),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              article.title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, height: 1.3),
            ),
            const SizedBox(height: 6),
            Text(
              article.summary,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: Theme.of(context).textTheme.bodySmall?.color, height: 1.4),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Text(article.author, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                const Spacer(),
                const Text('상세보기 →', style: TextStyle(fontSize: 12, color: Color(0xFF176B52), fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ArticleDetailScreen extends ConsumerStatefulWidget {
  const ArticleDetailScreen({super.key, required this.article});

  final Article article;

  @override
  ConsumerState<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends ConsumerState<ArticleDetailScreen> {
  double _fontSize = 15.0;

  List<Widget> _buildContentWidgets(String content, double fontSize) {
    if (content.isEmpty) return [];

    final widgets = <Widget>[];
    final lines = content.split('\n');
    final imgRegex = RegExp(r'!\[(.*?)\]\((.*?)\)');

    for (final rawLine in lines) {
      final line = rawLine.trim();
      if (line.isEmpty) continue;

      final match = imgRegex.firstMatch(line);
      if (match != null) {
        final alt = match.group(1) ?? '';
        final url = match.group(2) ?? '';
        widgets.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    url,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                  ),
                ),
                if (alt.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    alt,
                    style: const TextStyle(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic),
                  ),
                ],
              ],
            ),
          ),
        );
      } else if (line.startsWith('# ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 16, bottom: 8),
          child: Text(line.substring(2), style: TextStyle(fontSize: fontSize + 5, fontWeight: FontWeight.bold, height: 1.3)),
        ));
      } else if (line.startsWith('## ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 14, bottom: 6),
          child: Text(line.substring(3), style: TextStyle(fontSize: fontSize + 3, fontWeight: FontWeight.bold, height: 1.3)),
        ));
      } else if (line.startsWith('### ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 12, bottom: 4),
          child: Text(line.substring(4), style: TextStyle(fontSize: fontSize + 1, fontWeight: FontWeight.bold, height: 1.3)),
        ));
      } else {
        widgets.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 6.0),
          child: Text(
            line,
            style: TextStyle(fontSize: fontSize, height: 1.75, letterSpacing: -0.2),
          ),
        ));
      }
    }

    return widgets;
  }

  @override
  Widget build(BuildContext context) {
    final bookmarks = ref.watch(bookmarkedArticlesProvider);
    final isBookmarked = bookmarks.contains(widget.article.slug);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: Text(widget.article.category.toUpperCase(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.format_size),
            onPressed: () {
              setState(() {
                _fontSize = _fontSize == 15.0 ? 18.0 : (_fontSize == 18.0 ? 21.0 : 15.0);
              });
            },
          ),
          IconButton(
            icon: Icon(isBookmarked ? Icons.bookmark : Icons.bookmark_border),
            onPressed: () => ref.read(bookmarkedArticlesProvider.notifier).toggle(widget.article.slug),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.article.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, height: 1.3)),
            const SizedBox(height: 12),
            Row(
              children: [
                Text(widget.article.author, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(width: 8),
                const Text('·', style: TextStyle(color: Colors.grey)),
                const SizedBox(width: 8),
                Text('발행일: ${widget.article.publishedAt}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
            const Divider(height: 28),
            if (widget.article.coverImage.isNotEmpty) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  widget.article.coverImage,
                  width: double.infinity,
                  height: 220,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(widget.article.summary, style: TextStyle(fontSize: _fontSize, fontWeight: FontWeight.w500, height: 1.5)),
            ),
            const SizedBox(height: 20),
            ..._buildContentWidgets(
              widget.article.content.isNotEmpty ? widget.article.content : widget.article.summary,
              _fontSize,
            ),
            const SizedBox(height: 40),
            const Divider(),
            const Text('CHECK-IN DAILY EDITORIAL GUIDELINE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(height: 6),
            const Text('본 기사는 공인 언론사 보도자료 및 공항·항공사 공식 발표 자료를 팩트체크하여 발행되었습니다.', style: TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class SearchNewsScreen extends ConsumerStatefulWidget {
  const SearchNewsScreen({super.key});

  @override
  ConsumerState<SearchNewsScreen> createState() => _SearchNewsScreenState();
}

class _SearchNewsScreenState extends ConsumerState<SearchNewsScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final articlesAsync = ref.watch(articlesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('뉴스 통합 검색', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: '키워드, 도시, 항공사 검색...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onSubmitted: (val) => setState(() => _query = val.trim()),
            ),
          ),
          Expanded(
            child: articlesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.search_off, size: 40, color: Colors.grey),
                      const SizedBox(height: 8),
                      const Text(
                        '검색 데이터를 불러오지 못했습니다.\n잠시 후 다시 시도해 주세요.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        onPressed: () => ref.refresh(articlesProvider.future),
                        icon: const Icon(Icons.refresh),
                        label: const Text('새로고침'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (items) {
                final filtered = _query.isEmpty
                    ? items
                    : items.where((a) => a.title.contains(_query) || a.summary.contains(_query)).toList();
                if (filtered.isEmpty) {
                  return const Center(child: Text('검색 결과가 없습니다.'));
                }
                return ListView.builder(
                  itemCount: filtered.length,
                  itemBuilder: (context, index) => ArticleCard(article: filtered[index]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class BookmarksScreen extends ConsumerWidget {
  const BookmarksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookmarks = ref.watch(bookmarkedArticlesProvider);
    final articlesAsync = ref.watch(articlesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('내 스크랩북', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
      body: articlesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_off_outlined, size: 40, color: Colors.grey),
                const SizedBox(height: 8),
                const Text(
                  '스크랩 목록을 불러오는 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () => ref.refresh(articlesProvider.future),
                  icon: const Icon(Icons.refresh),
                  label: const Text('다시 시도'),
                ),
              ],
            ),
          ),
        ),
        data: (items) {
          final saved = items.where((a) => bookmarks.contains(a.slug)).toList();
          if (saved.isEmpty) {
            return const Center(child: Text('스크랩한 기사가 없습니다.\n기사 우측 상단의 북마크 버튼을 눌러보세요.', textAlign: TextAlign.center));
          }
          return ListView.builder(
            itemCount: saved.length,
            itemBuilder: (context, index) => ArticleCard(article: saved[index]),
          );
        },
      ),
    );
  }
}

class ReporterPortalScreen extends StatefulWidget {
  const ReporterPortalScreen({super.key});

  @override
  State<ReporterPortalScreen> createState() => _ReporterPortalScreenState();
}

class _ReporterPortalScreenState extends State<ReporterPortalScreen> {
  final _titleCtrl = TextEditingController();
  final _summaryCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  final _authorCtrl = TextEditingController();
  String _category = 'airline';
  bool _isSubmitting = false;

  void _submitDraft() async {
    if (_titleCtrl.text.isEmpty || _contentCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('제목과 본문을 입력해 주세요.')));
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dio = Dio(BaseOptions(
        baseUrl: apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));
      final response = await dio.post<Map<String, dynamic>>(
        '/api/partners/submissions',
        data: {
          'title': _titleCtrl.text.trim(),
          'summary': _summaryCtrl.text.trim(),
          'content': _contentCtrl.text.trim(),
          'category': _category,
          'submitterName': _authorCtrl.text.trim().isNotEmpty ? _authorCtrl.text.trim() : '모바일 특파원',
          'submitterEmail': 'mobile-reporter@checkindaily.com',
        },
      );
      if (mounted) {
        final message = response.data?['message'] ?? '초안이 성공적으로 제출되었습니다. 편집국 승인 후 발행됩니다.';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message.toString())));
      }
      _titleCtrl.clear();
      _summaryCtrl.clear();
      _contentCtrl.clear();
      _authorCtrl.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('제출 중 오류가 발생했습니다: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('기자·기고자 모바일 콘솔', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('기사 초안 / 현장 보도자료 투고', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('제출된 기사는 사실 확인 및 편집국 데스킹을 거쳐 6개 국어로 발행됩니다.', style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 16),
            TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: '기사 제목 *', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _summaryCtrl, decoration: const InputDecoration(labelText: '요약문 (1-2문장)', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: '카테고리 *', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'major', child: Text('주요뉴스 (major)')),
                DropdownMenuItem(value: 'airline', child: Text('항공 (airline)')),
                DropdownMenuItem(value: 'hotel', child: Text('호텔 (hotel)')),
                DropdownMenuItem(value: 'destination', child: Text('여행지 (destination)')),
                DropdownMenuItem(value: 'realtime', child: Text('실시간 (realtime)')),
              ],
              onChanged: (val) => setState(() => _category = val ?? 'airline'),
            ),
            const SizedBox(height: 12),
            TextField(controller: _authorCtrl, decoration: const InputDecoration(labelText: '기자 / 소속 기관명', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _contentCtrl, maxLines: 6, decoration: const InputDecoration(labelText: '기사 본문 *', border: OutlineInputBorder())),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submitDraft,
                icon: _isSubmitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send),
                label: const Text('편집국으로 초안 제출', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}