"""The detail endpoint: full related collections in a fixed number of queries."""

from django.test import TestCase
from django.urls import reverse

from .factories import days_ago, make_contact, make_document, make_note, make_submission


class SubmissionDetailTests(TestCase):
    def setUp(self):
        self.submission = make_submission()
        self.url = reverse('submission-detail', args=[self.submission.id])

    def test_returns_the_summary_fields_and_related_collections(self):
        make_contact(self.submission)
        make_document(self.submission)
        make_note(self.submission)

        body = self.client.get(self.url).json()

        self.assertEqual(
            set(body),
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
                'contacts',
                'documents',
                'notes',
            },
        )
        self.assertEqual(set(body['contacts'][0]), {'id', 'name', 'role', 'email', 'phone'})
        self.assertEqual(
            set(body['documents'][0]), {'id', 'title', 'docType', 'uploadedAt', 'fileUrl'}
        )
        self.assertEqual(set(body['notes'][0]), {'id', 'authorName', 'body', 'createdAt'})

    def test_notes_are_newest_first(self):
        make_note(self.submission, author_name='Oldest', created_at=days_ago(9))
        make_note(self.submission, author_name='Newest', created_at=days_ago(1))
        make_note(self.submission, author_name='Middle', created_at=days_ago(5))

        body = self.client.get(self.url).json()

        self.assertEqual(
            [n['authorName'] for n in body['notes']], ['Newest', 'Middle', 'Oldest']
        )

    def test_documents_are_newest_first(self):
        make_document(self.submission, title='Older', uploaded_at=days_ago(9))
        make_document(self.submission, title='Newer', uploaded_at=days_ago(1))

        body = self.client.get(self.url).json()

        self.assertEqual([d['title'] for d in body['documents']], ['Newer', 'Older'])

    def test_contacts_are_alphabetical(self):
        make_contact(self.submission, name='Zoe Adams')
        make_contact(self.submission, name='Alice Brown')

        body = self.client.get(self.url).json()

        self.assertEqual([c['name'] for c in body['contacts']], ['Alice Brown', 'Zoe Adams'])

    def test_notes_return_the_full_body_not_a_preview(self):
        long_body = 'sentence. ' * 60
        make_note(self.submission, body=long_body)

        body = self.client.get(self.url).json()

        self.assertEqual(body['notes'][0]['body'], long_body)

    def test_collections_are_empty_lists_when_nothing_is_attached(self):
        body = self.client.get(self.url).json()

        self.assertEqual(body['contacts'], [])
        self.assertEqual(body['documents'], [])
        self.assertEqual(body['notes'], [])

    def test_only_returns_rows_belonging_to_this_submission(self):
        make_note(self.submission, author_name='Mine')
        make_note(make_submission(), author_name='Theirs')

        body = self.client.get(self.url).json()

        self.assertEqual([n['authorName'] for n in body['notes']], ['Mine'])

    def test_unknown_id_is_a_404(self):
        response = self.client.get(reverse('submission-detail', args=[999_999]))

        self.assertEqual(response.status_code, 404)

    def test_query_count_is_flat_as_related_rows_grow(self):
        """A submission with hundreds of notes must not cost hundreds of queries."""
        for _ in range(2):
            make_contact(self.submission)
            make_document(self.submission)
            make_note(self.submission)

        with self.assertNumQueries(4):  # the row, plus one per prefetched collection
            self.client.get(self.url)

        for _ in range(40):
            make_note(self.submission)
            make_document(self.submission)

        with self.assertNumQueries(4):
            self.client.get(self.url)
