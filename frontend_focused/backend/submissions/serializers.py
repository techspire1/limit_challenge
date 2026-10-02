"""Read serializers for the submission workspace.

Field names stay snake_case here; `CamelCaseJSONRenderer` converts them on the
way out, so these mirror the model and the frontend's `lib/types.ts` at once.
"""

from rest_framework import serializers

from .models import Broker, Company, Contact, Document, Note, Submission, TeamMember

NOTE_PREVIEW_LENGTH = 160


class BrokerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Broker
        fields = ['id', 'name', 'primary_contact_email']


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'legal_name', 'industry', 'headquarters_city']


class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = ['id', 'full_name', 'email']


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'name', 'role', 'email', 'phone']


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'title', 'doc_type', 'uploaded_at', 'file_url']


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'author_name', 'body', 'created_at']


class SubmissionBaseSerializer(serializers.ModelSerializer):
    broker = BrokerSerializer(read_only=True)
    company = CompanySerializer(read_only=True)
    owner = TeamMemberSerializer(read_only=True)

    class Meta:
        model = Submission
        fields = [
            'id',
            'status',
            'priority',
            'summary',
            'created_at',
            'updated_at',
            'broker',
            'company',
            'owner',
        ]


class SubmissionListSerializer(SubmissionBaseSerializer):
    """Row shape for the list view: enough context to triage without opening it."""

    document_count = serializers.IntegerField(read_only=True)
    note_count = serializers.IntegerField(read_only=True)
    latest_note = serializers.SerializerMethodField()

    class Meta(SubmissionBaseSerializer.Meta):
        fields = SubmissionBaseSerializer.Meta.fields + [
            'document_count',
            'note_count',
            'latest_note',
        ]

    def get_latest_note(self, submission: Submission) -> dict | None:
        """Reads the annotations from `submission_list_queryset`, not `submission.notes`.

        Touching the relation here would issue a query per row.
        """
        body = getattr(submission, 'latest_note_body', None)
        if body is None:
            return None

        preview = ' '.join(body.split())
        if len(preview) > NOTE_PREVIEW_LENGTH:
            preview = preview[:NOTE_PREVIEW_LENGTH].rstrip() + '…'

        return {
            'author_name': submission.latest_note_author,
            'body_preview': preview,
            'created_at': submission.latest_note_created_at,
        }


class SubmissionDetailSerializer(SubmissionBaseSerializer):
    """Everything the detail page renders, in one round trip."""

    contacts = ContactSerializer(many=True, read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    notes = NoteSerializer(many=True, read_only=True)

    class Meta(SubmissionBaseSerializer.Meta):
        fields = SubmissionBaseSerializer.Meta.fields + [
            'contacts',
            'documents',
            'notes',
        ]
