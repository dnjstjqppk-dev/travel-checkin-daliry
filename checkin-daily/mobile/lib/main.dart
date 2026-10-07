import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8080',
);

final dioProvider = Provider<Dio>((ref) => Dio(BaseOptions(baseUrl: apiBaseUrl)));

final selectedCategoryProvider = StateProvider<String>((ref) => '');

final articlesProvider = FutureProvider<List<Article>>((ref) async {
  final category = ref.watch(selectedCategoryProvider);
  final response = await ref.watch(dioProvider).get<List<dynamic>>(
        '/api/articles',
        queryParameters: category.isEmpty ? null : {'category': category},
      );
  return (response.data ?? [])
      .map((json) => Article.fromJson(json as Map<String, dynamic>))
      .toList();
});

class Article {
  const Article({
    required this.title,
    required this.summary,
    required this.category,
    required this.author,
    required this.slug,
  });

  final String title;
  final String summary;
  final String category;
  final String author;
  final String slug;

  factory Article.fromJson(Map<String, dynamic> json) => Article(
        title: json['title'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        category: json['category'] as String? ?? '',
        author: json['author'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
      );
}

void main() => runApp(const ProviderScope(child: CheckinDailyApp()));

class CheckinDailyApp extends StatelessWidget {
  const CheckinDailyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: '체크인데일리',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF176B52)),
          scaffoldBackgroundColor: const Color(0xFFF6F6F1),
          useMaterial3: true,
          fontFamily: 'sans-serif',
        ),
        home: const NewsScreen(),
      );
}

class NewsScreen extends ConsumerWidget {
  const NewsScreen({super.key});

  static const categories = {
    '': '전체',
    'flights': '항공',
    'hotels': '호텔',
    'industry': '업계',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(selectedCategoryProvider);
    final articles = ref.watch(articlesProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'CHECK-IN DAILY',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 1.2),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(articlesProvider.future),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('TRAVEL INTELLIGENCE / KR', style: TextStyle(fontSize: 11, letterSpacing: 1.1)),
                    const SizedBox(height: 12),
                    Text('여행의 다음 장면을\n먼저 읽습니다.', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    const Text('발권의 숫자부터 호텔의 작은 차이까지, 오늘의 여행 인사이트.'),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      children: categories.entries.map((entry) => ChoiceChip(
                        label: Text(entry.value),
                        selected: selected == entry.key,
                        onSelected: (_) => ref.read(selectedCategoryProvider.notifier).state = entry.key,
                      )).toList(),
                    ),
                  ],
                ),
              ),
            ),
            articles.when(
              loading: () => const SliverFillRemaining(child: Center(child: CircularProgressIndicator())),
              error: (error, _) => SliverFillRemaining(
                child: Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('기사를 불러오지 못했습니다. API 연결을 확인해 주세요.\n$error', textAlign: TextAlign.center))),
              ),
              data: (items) => items.isEmpty
                  ? const SliverFillRemaining(child: Center(child: Text('아직 기사가 없습니다.')))
                  : SliverList.builder(
                      itemCount: items.length,
                      itemBuilder: (context, index) {
                        final article = items[index];
                        return Padding(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                          child: Container(
                            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFD8DDD4)))),
                            padding: const EdgeInsets.only(top: 14),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(categories[article.category] ?? article.category.toUpperCase(), style: const TextStyle(color: Color(0xFF176B52), fontSize: 11, fontWeight: FontWeight.w700)),
                              const SizedBox(height: 8),
                              Text(article.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                              const SizedBox(height: 6),
                              Text(article.summary, style: const TextStyle(height: 1.5, color: Color(0xFF69756F))),
                              const SizedBox(height: 8),
                              Text(article.author, style: const TextStyle(fontSize: 11, color: Color(0xFF69756F))),
                            ]),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}