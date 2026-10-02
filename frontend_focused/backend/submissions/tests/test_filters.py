"""Each list filter, and the combinations the filter bar can produce."""

from django.test import TestCase
from django.urls import reverse

from submissions.models import Submission

from .factories import (
    days_ago,
    make_broker,
    make_company,
    make_document,
    make_note,
    make_submission,
    make_team_member,
)


class StatusAndPriorityFilterTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')

    def test_filters_by_status(self):
        make_submission(status=Submission.Status.NEW)
        make_submission(status=Submission.Status.CLOSED)

        body = self.client.get(self.url, {'status': 'new'}).json()

        self.assertEqual(body['count'], 1)
        self.assertEqual(body['results'][0]['status'], 'new')

    def test_filters_by_priority(self):
        make_submission(priority=Submission.Priority.HIGH)
        make_submission(priority=Submission.Priority.LOW)

        body = self.client.get(self.url, {'priority': 'high'}).json()

        self.assertEqual(body['count'], 1)

    def test_unknown_status_is_rejected_rather_than_ignored(self):
        """Silently returning everything would look like a filter that does nothing."""
        make_submission(status=Submission.Status.NEW)

        response = self.client.get(self.url, {'status': 'archived'})

        self.assertEqual(response.status_code, 400)
        self.assertIn('status', response.json())

    def test_blank_status_means_no_filter(self):
        make_submission(status=Submission.Status.NEW)
        make_submission(status=Submission.Status.LOST)

        body = self.client.get(self.url, {'status': ''}).json()

        self.assertEqual(body['count'], 2)


class RelationFilterTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')

    def test_filters_by_broker_id(self):
        target = make_broker(name='Target Brokerage')
        make_submission(broker=target)
        make_submission(broker=make_broker(name='Other Brokerage'))

        body = self.client.get(self.url, {'brokerId': target.id}).json()

        self.assertEqual(body['count'], 1)
        self.assertEqual(body['results'][0]['broker']['name'], 'Target Brokerage')

    def test_filters_by_owner_id(self):
        owner = make_team_member(full_name='Dana Owner')
        make_submission(owner=owner)
        make_submission()

        body = self.client.get(self.url, {'ownerId': owner.id}).json()

        self.assertEqual(body['count'], 1)
        self.assertEqual(body['results'][0]['owner']['fullName'], 'Dana Owner')

    def test_unmatched_broker_returns_an_empty_page_not_an_error(self):
        make_submission()

        body = self.client.get(self.url, {'brokerId': 999_999}).json()

        self.assertEqual(body['count'], 0)
        self.assertEqual(body['results'], [])

    def test_non_numeric_broker_id_is_rejected(self):
        make_submission()

        response = self.client.get(self.url, {'brokerId': 'abc'})

        self.assertEqual(response.status_code, 400)


class CompanySearchTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')
        self.acme = make_submission(
            company=make_company(
                legal_name='Acme Industrial', industry='Manufacturing', headquarters_city='Detroit'
            )
        )
        self.globex = make_submission(
            company=make_company(
                legal_name='Globex Freight', industry='Logistics', headquarters_city='Chicago'
            )
        )

    def test_matches_a_partial_legal_name(self):
        body = self.client.get(self.url, {'companySearch': 'acm'}).json()

        self.assertEqual([r['id'] for r in body['results']], [self.acme.id])

    def test_match_is_case_insensitive(self):
        body = self.client.get(self.url, {'companySearch': 'GLOBEX'}).json()

        self.assertEqual([r['id'] for r in body['results']], [self.globex.id])

    def test_matches_the_headquarters_city(self):
        body = self.client.get(self.url, {'companySearch': 'chicago'}).json()

        self.assertEqual([r['id'] for r in body['results']], [self.globex.id])

    def test_matches_the_industry(self):
        body = self.client.get(self.url, {'companySearch': 'manufact'}).json()

        self.assertEqual([r['id'] for r in body['results']], [self.acme.id])

    def test_whitespace_only_search_is_treated_as_empty(self):
        body = self.client.get(self.url, {'companySearch': '   '}).json()

        self.assertEqual(body['count'], 2)

    def test_no_match_returns_an_empty_page(self):
        body = self.client.get(self.url, {'companySearch': 'zzzz'}).json()

        self.assertEqual(body['count'], 0)


class CreatedDateFilterTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')
        self.old = make_submission(summary='old', created_at=days_ago(30))
        self.recent = make_submission(summary='recent', created_at=days_ago(2))

    def test_created_from_keeps_newer_submissions(self):
        body = self.client.get(
            self.url, {'createdFrom': days_ago(7).date().isoformat()}
        ).json()

        self.assertEqual([r['summary'] for r in body['results']], ['recent'])

    def test_created_to_keeps_older_submissions(self):
        body = self.client.get(self.url, {'createdTo': days_ago(7).date().isoformat()}).json()

        self.assertEqual([r['summary'] for r in body['results']], ['old'])

    def test_range_can_exclude_everything(self):
        body = self.client.get(
            self.url,
            {
                'createdFrom': days_ago(20).date().isoformat(),
                'createdTo': days_ago(10).date().isoformat(),
            },
        ).json()

        self.assertEqual(body['count'], 0)

    def test_created_to_includes_submissions_from_that_same_day(self):
        """Comparing against the datetime would cut off everything after midnight."""
        today = make_submission(summary='today', created_at=days_ago(0))

        body = self.client.get(self.url, {'createdTo': days_ago(0).date().isoformat()}).json()

        self.assertIn(today.id, [r['id'] for r in body['results']])

    def test_malformed_date_is_rejected(self):
        response = self.client.get(self.url, {'createdFrom': 'last-tuesday'})

        self.assertEqual(response.status_code, 400)


class AttachmentFilterTests(TestCase):
    def setUp(self):
        self.url = reverse('submission-list')
        self.with_both = make_submission(summary='with both')
        make_document(self.with_both)
        make_note(self.with_both)
        self.empty = make_submission(summary='empty')

    def test_has_documents_true(self):
        body = self.client.get(self.url, {'hasDocuments': 'true'}).json()

        self.assertEqual([r['summary'] for r in body['results']], ['with both'])

    def test_has_documents_false(self):
        body = self.client.get(self.url, {'hasDocuments': 'false'}).json()

        self.assertEqual([r['summary'] for r in body['results']], ['empty'])

    def test_has_notes_true(self):
        body = self.client.get(self.url, {'hasNotes': 'true'}).json()

        self.assertEqual([r['summary'] for r in body['results']], ['with both'])

    def test_has_notes_false(self):
        body = self.client.get(self.url, {'hasNotes': 'false'}).json()

        self.assertEqual([r['summary'] for r in body['results']], ['empty'])

    def test_existence_filter_does_not_duplicate_rows(self):
        """A join-based filter would return the row once per document."""
        for _ in range(3):
            make_document(self.with_both)

        body = self.client.get(self.url, {'hasDocuments': 'true'}).json()

        self.assertEqual(body['count'], 1)
        self.assertEqual(len(body['results']), 1)


class CombinedFilterTests(TestCase):
    def test_filters_narrow_each_other(self):
        url = reverse('submission-list')
        broker = make_broker()
        wanted = make_submission(
            broker=broker,
            status=Submission.Status.IN_REVIEW,
            company=make_company(legal_name='Acme Industrial'),
            created_at=days_ago(3),
        )
        make_note(wanted)
        # Same broker and status, different company.
        other = make_submission(
            broker=broker,
            status=Submission.Status.IN_REVIEW,
            company=make_company(legal_name='Globex Freight'),
            created_at=days_ago(3),
        )
        make_note(other)
        # Right company, wrong status.
        make_submission(
            broker=broker,
            status=Submission.Status.CLOSED,
            company=make_company(legal_name='Acme Holdings'),
        )

        body = self.client.get(
            url,
            {
                'brokerId': broker.id,
                'status': 'in_review',
                'companySearch': 'acme',
                'hasNotes': 'true',
                'createdFrom': days_ago(10).date().isoformat(),
            },
        ).json()

        self.assertEqual([r['id'] for r in body['results']], [wanted.id])

    def test_filtered_count_reflects_the_filter_not_the_table(self):
        url = reverse('submission-list')
        for _ in range(15):
            make_submission(status=Submission.Status.NEW)
        make_submission(status=Submission.Status.LOST)

        body = self.client.get(url, {'status': 'lost', 'pageSize': 5}).json()

        self.assertEqual(body['count'], 1)
