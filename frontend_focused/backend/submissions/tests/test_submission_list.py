"""The list endpoint's payload shape, aggregates, pagination and query cost."""

from django.test import TestCase
from django.urls import reverse

from submissions.models import Submission
from submissions.serializers import NOTE_PREVIEW_LENGTH

from .factories import days_ago, make_document, make_note, make_submission


class SubmissionListPayloadTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')

    def test_row_exposes_the_fields_the_list_view_renders(self):
        make_submission()

        row = self.client.get(self.url).json()['results'][0]

        self.assertEqual(
            set(row),
            {
                'id',
                'status',
                'priority',
                'summary',
                'createdAt',
                'updatedAt',
                'broker',
                'company',
                'owner',
                'documentCount',
                'noteCount',
                'latestNote',
            },
        )
        self.assertEqual(set(row['company']), {'id', 'legalName', 'industry', 'headquartersCity'})
        self.assertEqual(set(row['broker']), {'id', 'name', 'primaryContactEmail'})
        self.assertEqual(set(row['owner']), {'id', 'fullName', 'email'})

    def test_counts_are_not_inflated_by_joining_both_relations(self):
        """A plain `Count` over two relations reports documents x notes."""
        submission = make_submission()
        for _ in range(3):
            make_document(submission)
        for _ in range(4):
            make_note(submission)

        row = self.client.get(self.url).json()['results'][0]

        self.assertEqual(row['documentCount'], 3)
        self.assertEqual(row['noteCount'], 4)

    def test_counts_are_zero_when_nothing_is_attached(self):
        make_submission()

        row = self.client.get(self.url).json()['results'][0]

        self.assertEqual(row['documentCount'], 0)
        self.assertEqual(row['noteCount'], 0)
        self.assertIsNone(row['latestNote'])

    def test_latest_note_is_the_newest_one(self):
        submission = make_submission()
        make_note(submission, author_name='Older', body='old', created_at=days_ago(5))
        make_note(submission, author_name='Newest', body='new', created_at=days_ago(1))
        make_note(submission, author_name='Middle', body='mid', created_at=days_ago(3))

        latest = self.client.get(self.url).json()['results'][0]['latestNote']

        self.assertEqual(latest['authorName'], 'Newest')
        self.assertEqual(latest['bodyPreview'], 'new')

    def test_long_note_bodies_are_truncated_to_a_preview(self):
        submission = make_submission()
        make_note(submission, body='word ' * 200)

        preview = self.client.get(self.url).json()['results'][0]['latestNote']['bodyPreview']

        self.assertLessEqual(len(preview), NOTE_PREVIEW_LENGTH + 1)
        self.assertTrue(preview.endswith('…'))

    def test_note_preview_collapses_whitespace(self):
        submission = make_submission()
        make_note(submission, body='first line\n\n  second   line ')

        preview = self.client.get(self.url).json()['results'][0]['latestNote']['bodyPreview']

        self.assertEqual(preview, 'first line second line')


class SubmissionListOrderingTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')

    def test_defaults_to_newest_first(self):
        make_submission(summary='oldest', created_at=days_ago(10))
        make_submission(summary='newest', created_at=days_ago(1))

        results = self.client.get(self.url).json()['results']

        self.assertEqual([r['summary'] for r in results], ['newest', 'oldest'])

    def test_priority_sorts_by_urgency_not_alphabetically(self):
        for priority in (Submission.Priority.LOW, Submission.Priority.HIGH, Submission.Priority.MEDIUM):
            make_submission(priority=priority)

        results = self.client.get(self.url, {'ordering': 'priority'}).json()['results']

        self.assertEqual([r['priority'] for r in results], ['high', 'medium', 'low'])

    def test_ordering_accepts_a_descending_prefix(self):
        for priority in (Submission.Priority.HIGH, Submission.Priority.LOW):
            make_submission(priority=priority)

        results = self.client.get(self.url, {'ordering': '-priority'}).json()['results']

        self.assertEqual([r['priority'] for r in results], ['low', 'high'])

    def test_can_order_by_an_annotated_count(self):
        quiet = make_submission(summary='quiet')
        busy = make_submission(summary='busy')
        for _ in range(3):
            make_note(busy)
        make_note(quiet)

        results = self.client.get(self.url, {'ordering': '-noteCount'}).json()['results']

        self.assertEqual([r['summary'] for r in results], ['busy', 'quiet'])

    def test_unknown_ordering_field_falls_back_to_the_default(self):
        make_submission(summary='oldest', created_at=days_ago(10))
        make_submission(summary='newest', created_at=days_ago(1))

        results = self.client.get(self.url, {'ordering': 'nonsense'}).json()['results']

        self.assertEqual([r['summary'] for r in results], ['newest', 'oldest'])


class SubmissionListPaginationTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')

    def test_reports_the_total_alongside_the_page(self):
        for index in range(12):
            make_submission(created_at=days_ago(index))

        body = self.client.get(self.url).json()

        self.assertEqual(body['count'], 12)
        self.assertEqual(len(body['results']), 10)
        self.assertIsNotNone(body['next'])
        self.assertIsNone(body['previous'])

    def test_page_size_is_client_controlled(self):
        for index in range(6):
            make_submission(created_at=days_ago(index))

        body = self.client.get(self.url, {'pageSize': 2}).json()

        self.assertEqual(len(body['results']), 2)

    def test_page_size_is_capped(self):
        for index in range(3):
            make_submission(created_at=days_ago(index))

        body = self.client.get(self.url, {'pageSize': 10_000}).json()

        self.assertEqual(len(body['results']), 3)

    def test_pages_do_not_overlap_when_sorting_on_a_shared_value(self):
        """Without a unique tie-breaker, rows can repeat across pages."""
        for index in range(6):
            make_submission(status=Submission.Status.NEW, created_at=days_ago(index))

        first = self.client.get(self.url, {'ordering': 'status', 'pageSize': 3}).json()
        second = self.client.get(
            self.url, {'ordering': 'status', 'pageSize': 3, 'page': 2}
        ).json()

        ids = [r['id'] for r in first['results']] + [r['id'] for r in second['results']]
        self.assertEqual(len(ids), len(set(ids)))


class ResponseHeaderTests(TestCase):
    def test_responses_are_marked_uncacheable(self):
        """Otherwise a browser may heuristically serve stale submission data."""
        make_submission()

        for url in (reverse('submission-list'), reverse('broker-list')):
            with self.subTest(url=url):
                response = self.client.get(url)

                self.assertIn('no-store', response['Cache-Control'])


class SubmissionListQueryCountTests(TestCase):
    def test_query_count_does_not_grow_with_the_number_of_rows(self):
        """Guards the annotations: reading a relation per row would scale with the page."""
        url = reverse('submission-list')
        for index in range(3):
            submission = make_submission(created_at=days_ago(index))
            make_note(submission)
            make_document(submission)

        with self.assertNumQueries(2):  # one COUNT for pagination, one for the page
            self.client.get(url)

        for index in range(3, 15):
            submission = make_submission(created_at=days_ago(index))
            make_note(submission)
            make_document(submission)

        with self.assertNumQueries(2):
            self.client.get(url, {'pageSize': 15})
