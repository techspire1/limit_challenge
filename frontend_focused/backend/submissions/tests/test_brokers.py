"""The brokers endpoint that populates the list view's filter dropdown."""

from django.test import TestCase
from django.urls import reverse

from .factories import make_broker


class BrokerListTests(TestCase):
    def setUp(self):
        self.url = reverse('broker-list')

    def test_returns_a_plain_array_so_the_dropdown_needs_no_paging(self):
        make_broker()

        body = self.client.get(self.url).json()

        self.assertIsInstance(body, list)

    def test_exposes_the_fields_the_dropdown_needs(self):
        make_broker(name='Acme Brokerage', primary_contact_email='team@acme.test')

        body = self.client.get(self.url).json()

        self.assertEqual(body[0], {'id': body[0]['id'], 'name': 'Acme Brokerage',
                                   'primaryContactEmail': 'team@acme.test'})

    def test_brokers_are_alphabetical(self):
        make_broker(name='Zenith Brokerage')
        make_broker(name='Apex Brokerage')

        names = [b['name'] for b in self.client.get(self.url).json()]

        self.assertEqual(names, ['Apex Brokerage', 'Zenith Brokerage'])

    def test_returns_every_broker_even_past_the_default_page_size(self):
        for index in range(14):
            make_broker(name=f'Broker {index:02d}')

        body = self.client.get(self.url).json()

        self.assertEqual(len(body), 14)

    def test_empty_when_there_are_no_brokers(self):
        self.assertEqual(self.client.get(self.url).json(), [])
