import { useState, useEffect } from 'react';
import { Plus, FileText, Sparkles, Loader2, Download, Trash2, Edit, RefreshCw, Share2, CheckCircle, Clock, DollarSign, Repeat, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useContracts, Contract } from '@/hooks/useContracts';
import { useClient } from '@/hooks/useClients';
import { useAgencySettings } from '@/hooks/useAgencySettings';
import { useContractSignatures } from '@/hooks/useContractSignatures';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { downloadContractPdf } from '@/lib/contractPdf';
import { GenerateContractShareLinkDialog } from '@/components/dialogs/GenerateContractShareLinkDialog';

interface ContractsTabProps {
  clientId: string;
}

const CONTRACT_TYPES = [
  { id: 'retainer', label: 'Monthly Retainer' },
  { id: 'project', label: 'Project-Based' },
  { id: 'one-off', label: 'One-Off Service' },
  { id: 'consulting', label: 'Consulting Agreement' },
];

const CONTRACT_STATUSES = [
  { id: 'draft', label: 'Draft', color: 'bg-yellow-500' },
  { id: 'sent', label: 'Sent to Client', color: 'bg-blue-500' },
  { id: 'signed', label: 'Signed', color: 'bg-green-500' },
  { id: 'expired', label: 'Expired', color: 'bg-gray-500' },
];

// Sanitize content - strip any remaining markdown
const sanitizeContent = (text: string): string => {
  return text
    .replace(/\*\*/g, '')           // Remove ** bold
    .replace(/\*/g, '')             // Remove * italic
    .replace(/^#+\s*/gm, '')        // Remove # headings
    .replace(/`([^`]+)`/g, '$1')    // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/_{2,}/g, '_')         // Normalize underscores
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links
};

const formatBillingInterval = (interval: string | null) => {
  switch (interval) {
    case 'weekly': return '/week';
    case 'monthly': return '/month';
    case 'yearly': return '/year';
    default: return '/month';
  }
};

// Contract Card component with signature status
function ContractCard({ contract, status, onEdit, onExport, onDelete, onShare, onCancelSubscription, isCancelling }: {
  contract: Contract;
  status: { id: string; label: string; color: string };
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
  onShare: () => void;
  onCancelSubscription: () => void;
  isCancelling: boolean;
}) {
  const { agencySignature, clientSignature, isFullySigned } = useContractSignatures(contract.id);
  
  const isRecurring = contract.payment_type === 'recurring';
  const hasActiveSubscription = isRecurring && contract.stripe_subscription_id && contract.payment_status === 'paid';
  
  return (
    <Card className="group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base truncate">{contract.title}</CardTitle>
            <CardDescription className="text-xs">
              {CONTRACT_TYPES.find(t => t.id === contract.contract_type)?.label || 'Agreement'}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            <span className={`w-2 h-2 rounded-full ${status.color} mr-1.5`} />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Version {contract.version}</p>
          <p>Updated {format(new Date(contract.updated_at), 'MMM d, yyyy')}</p>
          {contract.start_date && (
            <p>Period: {format(new Date(contract.start_date), 'MMM d, yyyy')} - {contract.end_date ? format(new Date(contract.end_date), 'MMM d, yyyy') : 'Ongoing'}</p>
          )}
        </div>
        
        {/* Payment Status */}
        {contract.payment_amount && contract.payment_amount > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              {isRecurring ? <Repeat className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
              <span>
                {isRecurring ? (
                  <>
                    {contract.initial_payment_amount && contract.initial_payment_amount !== contract.payment_amount ? (
                      <>
                        ${Number(contract.initial_payment_amount).toFixed(0)} first, then ${Number(contract.payment_amount).toFixed(0)}{formatBillingInterval(contract.billing_interval)}
                      </>
                    ) : (
                      <>
                        ${Number(contract.payment_amount).toFixed(0)}{formatBillingInterval(contract.billing_interval)}
                      </>
                    )}
                  </>
                ) : (
                  <>${Number(contract.payment_amount).toFixed(2)} {contract.payment_currency?.toUpperCase() || 'AUD'}</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {contract.payment_status === 'paid' && (
                <Badge variant="default" className="text-xs bg-green-600">
                  {isRecurring ? 'Active' : 'Paid'}
                </Badge>
              )}
              {contract.payment_status === 'pending' && (
                <Badge variant="secondary" className="text-xs">Payment Pending</Badge>
              )}
              {contract.payment_status === 'processing' && (
                <Badge variant="secondary" className="text-xs">Processing</Badge>
              )}
              {contract.payment_status === 'failed' && (
                <Badge variant="destructive" className="text-xs">Failed</Badge>
              )}
              {contract.payment_status === 'past_due' && (
                <Badge variant="destructive" className="text-xs">Past Due</Badge>
              )}
              {contract.payment_status === 'cancelling' && (
                <Badge variant="secondary" className="text-xs">Cancelling</Badge>
              )}
              {contract.payment_status === 'cancelled' && (
                <Badge variant="outline" className="text-xs">Cancelled</Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Signature Status */}
        <div className="flex items-center gap-2 text-xs">
          <div className={`flex items-center gap-1 ${agencySignature ? 'text-green-600' : 'text-muted-foreground'}`}>
            {agencySignature ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            Agency
          </div>
          <div className={`flex items-center gap-1 ${clientSignature ? 'text-green-600' : 'text-muted-foreground'}`}>
            {clientSignature ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            Client
          </div>
          {isFullySigned && <Badge variant="default" className="text-xs ml-auto">Signed</Badge>}
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onEdit}>
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onShare}>
            <Share2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Cancel Subscription Button */}
        {hasActiveSubscription && (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full text-destructive hover:text-destructive"
            onClick={onCancelSubscription}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            Cancel Subscription
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ContractsTab({ clientId }: ContractsTabProps) {
  const { contracts, isLoading, createContract, updateContract, deleteContract, cancelSubscription, isCreating, isUpdating, isCancellingSubscription } = useContracts(clientId);
  const { data: client } = useClient(clientId);
  const { settings: agencySettings } = useAgencySettings();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [shareDialogContract, setShareDialogContract] = useState<Contract | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [contractType, setContractType] = useState('retainer');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [content, setContent] = useState('');
  const [requirePayment, setRequirePayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentCurrency, setPaymentCurrency] = useState('aud');
  
  // Recurring payment state
  const [paymentType, setPaymentType] = useState<'one_time' | 'recurring'>('one_time');
  const [billingInterval, setBillingInterval] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [customFirstPayment, setCustomFirstPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<string>('');
  
  // GST state
  const [includeGst, setIncludeGst] = useState(false);
  const [gstPercentage, setGstPercentage] = useState<string>('10');
  
  // Contact information - don't auto-populate agency name
  const [agencyName, setAgencyName] = useState('Arris Studios');
  const [agencyContactName, setAgencyContactName] = useState('');
  const [agencyEmail, setAgencyEmail] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [clientContactName, setClientContactName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [governingJurisdiction, setGoverningJurisdiction] = useState('California, USA');

  // Only auto-populate client info, not agency
  useEffect(() => {
    if (client) {
      setClientContactName(client.contact_name || '');
      setClientEmail(client.email || '');
      setClientPhone(client.phone || '');
    }
  }, [client]);

  const resetForm = () => {
    setTitle(client ? `Service Agreement - Arris Studios - ${client.business_name}` : 'Service Agreement - Arris Studios');
    setContractType('retainer');
    setScopeOfWork('');
    setDeliverables('');
    setPaymentTerms('');
    setStartDate('');
    setEndDate('');
    setContent('');
    setRevisionFeedback('');
    setSelectedContract(null);
    setRequirePayment(false);
    setPaymentAmount('');
    setPaymentCurrency('aud');
    setPaymentType('one_time');
    setBillingInterval('monthly');
    setCustomFirstPayment(false);
    setInitialPaymentAmount('');
    setIncludeGst(false);
    setGstPercentage('10');
    // Reset agency fields to Arris Studios
    setAgencyName('Arris Studios');
    setAgencyContactName('');
    setAgencyEmail('');
    setAgencyPhone('');
    setGoverningJurisdiction('California, USA');
    // Reset client info from client data
    if (client) {
      setClientContactName(client.contact_name || '');
      setClientEmail(client.email || '');
      setClientPhone(client.phone || '');
    }
  };

  const handleOpenNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (contract: Contract) => {
    setSelectedContract(contract);
    setTitle(contract.title);
    setContractType(contract.contract_type || 'retainer');
    setScopeOfWork(contract.scope_of_work || '');
    setDeliverables(contract.deliverables || '');
    setPaymentTerms(contract.payment_terms || '');
    setStartDate(contract.start_date || '');
    setEndDate(contract.end_date || '');
    setContent(contract.content);
    setRequirePayment(!!contract.payment_amount && contract.payment_amount > 0);
    setPaymentAmount(contract.payment_amount ? String(contract.payment_amount) : '');
    setPaymentCurrency(contract.payment_currency || 'aud');
    setPaymentType(contract.payment_type || 'one_time');
    setBillingInterval(contract.billing_interval || 'monthly');
    setCustomFirstPayment(!!contract.initial_payment_amount && contract.initial_payment_amount !== contract.payment_amount);
    setInitialPaymentAmount(contract.initial_payment_amount ? String(contract.initial_payment_amount) : '');
    setIncludeGst(contract.include_gst || false);
    setGstPercentage(contract.gst_percentage ? String(contract.gst_percentage) : '10');
    setIsDialogOpen(true);
  };

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-contract', {
        body: {
          clientId,
          contractType,
          scopeOfWork,
          deliverables,
          paymentTerms,
          startDate,
          endDate,
          agencyName,
          agencyContactName,
          agencyEmail,
          agencyPhone,
          clientContactName,
          clientEmail,
          clientPhone,
          paymentAmount: requirePayment && paymentAmount ? parseFloat(paymentAmount) : null,
          paymentCurrency: requirePayment ? paymentCurrency : null,
          billingInterval: requirePayment && paymentType === 'recurring' ? billingInterval : null,
          initialPaymentAmount: requirePayment && paymentType === 'recurring' && customFirstPayment && initialPaymentAmount 
            ? parseFloat(initialPaymentAmount) 
            : null,
          governingJurisdiction,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setContent(data.content);
      if (!title) {
        setTitle(`${CONTRACT_TYPES.find(t => t.id === contractType)?.label || 'Service'} Agreement - ${client?.business_name}`);
      }
      toast({ title: 'Contract generated!' });
    } catch (error) {
      console.error('Error generating contract:', error);
      toast({
        title: 'Failed to generate contract',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReviseWithAI = async () => {
    if (!revisionFeedback.trim()) {
      toast({ title: 'Please enter revision feedback', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-contract', {
        body: {
          clientId,
          contractType,
          scopeOfWork,
          deliverables,
          paymentTerms,
          startDate,
          endDate,
          revisionFeedback,
          existingContent: content,
          agencyName,
          agencyContactName,
          agencyEmail,
          agencyPhone,
          clientContactName,
          clientEmail,
          clientPhone,
          paymentAmount: requirePayment && paymentAmount ? parseFloat(paymentAmount) : null,
          paymentCurrency: requirePayment ? paymentCurrency : null,
          billingInterval: requirePayment && paymentType === 'recurring' ? billingInterval : null,
          initialPaymentAmount: requirePayment && paymentType === 'recurring' && customFirstPayment && initialPaymentAmount 
            ? parseFloat(initialPaymentAmount) 
            : null,
          governingJurisdiction,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setContent(data.content);
      setRevisionFeedback('');
      toast({ title: 'Contract revised!' });
    } catch (error) {
      console.error('Error revising contract:', error);
      toast({
        title: 'Failed to revise contract',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }

    const contractData = {
      title,
      contract_type: contractType,
      scope_of_work: scopeOfWork || null,
      deliverables: deliverables || null,
      payment_terms: paymentTerms || null,
      start_date: startDate || null,
      end_date: endDate || null,
      content,
      payment_amount: requirePayment && paymentAmount ? parseFloat(paymentAmount) : null,
      payment_currency: requirePayment ? paymentCurrency : null,
      payment_status: requirePayment && paymentAmount ? 'pending' : 'not_required',
      payment_type: requirePayment ? paymentType : null,
      billing_interval: requirePayment && paymentType === 'recurring' ? billingInterval : null,
      initial_payment_amount: requirePayment && paymentType === 'recurring' && customFirstPayment && initialPaymentAmount 
        ? parseFloat(initialPaymentAmount) 
        : null,
      include_gst: requirePayment && includeGst ? true : false,
      gst_percentage: requirePayment && includeGst && gstPercentage ? parseFloat(gstPercentage) : null,
    };

    if (selectedContract) {
      updateContract({
        id: selectedContract.id,
        ...contractData,
        version: selectedContract.version + 1,
      });
    } else {
      createContract({
        client_id: clientId,
        ...contractData,
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleExportPDF = async (contract: Contract) => {
    try {
      // Fetch fresh signatures for this contract
      const { data: signatures, error } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('contract_id', contract.id);

      if (error) {
        console.error('Error fetching signatures:', error);
      }

      const agencySig = signatures?.find(s => s.signer_role === 'agency' && s.signed_at);
      const clientSig = signatures?.find(s => s.signer_role === 'client' && s.signed_at);

      // Call the proper PDF generator with signatures
      await downloadContractPdf(contract, client, {
        agencyName: agencyName || 'Arris Studios',
        agencyContactName,
        agencyEmail,
        agencyPhone,
        agencySignature: agencySig ? {
          signer_name: agencySig.signer_name,
          signer_title: agencySig.signer_title || undefined,
          signature_data: agencySig.signature_data!,
          signed_at: agencySig.signed_at!,
        } : undefined,
        clientSignature: clientSig ? {
          signer_name: clientSig.signer_name,
          signer_title: clientSig.signer_title || undefined,
          signature_data: clientSig.signature_data!,
          signed_at: clientSig.signed_at!,
        } : undefined,
      });

      toast({ title: 'PDF exported!' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Failed to export PDF',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this contract?')) {
      deleteContract(id);
    }
  };

  const handleCancelSubscription = (contractId: string) => {
    if (confirm('Are you sure you want to cancel this subscription? The subscription will be cancelled at the end of the current billing period.')) {
      cancelSubscription(contractId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contracts</h2>
          <p className="text-sm text-muted-foreground">Generate and manage client contracts with AI</p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="h-4 w-4" />
          New Contract
        </Button>
      </div>

      {/* Contracts Grid */}
      {contracts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No contracts yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first contract with AI assistance
            </p>
            <Button onClick={handleOpenNew} variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Contract
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map(contract => {
            const status = CONTRACT_STATUSES.find(s => s.id === contract.status) || CONTRACT_STATUSES[0];
            return (
              <ContractCard 
                key={contract.id}
                contract={contract}
                status={status}
                onEdit={() => handleOpenEdit(contract)}
                onExport={() => handleExportPDF(contract)}
                onDelete={() => handleDelete(contract.id)}
                onShare={() => setShareDialogContract(contract)}
                onCancelSubscription={() => handleCancelSubscription(contract.id)}
                isCancelling={isCancellingSubscription}
              />
            );
          })}
        </div>
      )}

      {/* Contract Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedContract ? 'Edit Contract' : 'New Contract'}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left Column - Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Contract Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Service Agreement - Client Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contract Type</Label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />
                
                {/* Agency Contact Info */}
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Agency / Provider Info</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="Agency Name"
                    />
                    <Input
                      value={agencyContactName}
                      onChange={(e) => setAgencyContactName(e.target.value)}
                      placeholder="Contact Name"
                    />
                    <Input
                      value={agencyEmail}
                      onChange={(e) => setAgencyEmail(e.target.value)}
                      placeholder="Email"
                    />
                    <Input
                      value={agencyPhone}
                      onChange={(e) => setAgencyPhone(e.target.value)}
                      placeholder="Phone"
                    />
                  </div>
                </div>

                {/* Client Contact Info */}
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Client Info</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={client?.business_name || ''}
                      disabled
                      placeholder="Business Name"
                      className="bg-muted"
                    />
                    <Input
                      value={clientContactName}
                      onChange={(e) => setClientContactName(e.target.value)}
                      placeholder="Contact Name"
                    />
                    <Input
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="Email"
                    />
                    <Input
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Phone"
                    />
                  </div>
                </div>

                {/* Governing Jurisdiction */}
                <div className="space-y-2">
                  <Label>Governing Jurisdiction</Label>
                  <Input
                    value={governingJurisdiction}
                    onChange={(e) => setGoverningJurisdiction(e.target.value)}
                    placeholder="California, USA"
                  />
                  <p className="text-xs text-muted-foreground">The legal jurisdiction that will govern this contract</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Scope of Work</Label>
                  <Textarea
                    value={scopeOfWork}
                    onChange={(e) => setScopeOfWork(e.target.value)}
                    placeholder="Describe the services to be provided..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Deliverables</Label>
                  <Textarea
                    value={deliverables}
                    onChange={(e) => setDeliverables(e.target.value)}
                    placeholder="List specific deliverables..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Textarea
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Monthly retainer, due within 14 days..."
                    rows={2}
                  />
                </div>

                <Separator />

                {/* Payment Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="require-payment"
                      checked={requirePayment}
                      onCheckedChange={(checked) => setRequirePayment(checked === true)}
                    />
                    <Label htmlFor="require-payment" className="text-sm font-medium cursor-pointer">
                      Require payment with this contract
                    </Label>
                  </div>
                  
                  {requirePayment && (
                    <div className="space-y-4 pl-6 border-l-2 border-muted">
                      {/* Payment Type */}
                      <div className="space-y-2">
                        <Label className="text-xs">Payment Type</Label>
                        <Select value={paymentType} onValueChange={(v) => setPaymentType(v as 'one_time' | 'recurring')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one_time">One-time payment</SelectItem>
                            <SelectItem value="recurring">Recurring subscription</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Billing Interval (for recurring) */}
                      {paymentType === 'recurring' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Billing Interval</Label>
                          <Select value={billingInterval} onValueChange={(v) => setBillingInterval(v as 'weekly' | 'monthly' | 'yearly')}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Amount & Currency */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {paymentType === 'recurring' ? 'Recurring Amount' : 'Amount'}
                          </Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Currency</Label>
                          <Select value={paymentCurrency} onValueChange={setPaymentCurrency}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aud">AUD</SelectItem>
                              <SelectItem value="usd">USD</SelectItem>
                              <SelectItem value="eur">EUR</SelectItem>
                              <SelectItem value="gbp">GBP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Custom First Payment (for recurring) */}
                      {paymentType === 'recurring' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id="custom-first-payment"
                              checked={customFirstPayment}
                              onCheckedChange={(checked) => setCustomFirstPayment(checked === true)}
                            />
                            <Label htmlFor="custom-first-payment" className="text-xs cursor-pointer">
                              Different first payment amount
                            </Label>
                          </div>
                          
                          {customFirstPayment && (
                            <div className="space-y-1">
                              <Label className="text-xs">Initial Payment Amount</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={initialPaymentAmount}
                                onChange={(e) => setInitialPaymentAmount(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                First payment: ${initialPaymentAmount || '0'}, then ${paymentAmount || '0'}{formatBillingInterval(billingInterval)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* GST Configuration */}
                      <Separator className="my-2" />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="include-gst"
                            checked={includeGst}
                            onCheckedChange={(checked) => setIncludeGst(checked === true)}
                          />
                          <Label htmlFor="include-gst" className="text-xs cursor-pointer">
                            Add GST to payment
                          </Label>
                        </div>
                        
                        {includeGst && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">GST Rate (%)</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="10"
                                value={gstPercentage}
                                onChange={(e) => setGstPercentage(e.target.value)}
                                className="w-24"
                              />
                            </div>
                            {paymentAmount && (
                              <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded">
                                <p>Subtotal: ${parseFloat(paymentAmount).toFixed(2)}</p>
                                <p>GST ({gstPercentage}%): ${(parseFloat(paymentAmount) * (parseFloat(gstPercentage) / 100)).toFixed(2)}</p>
                                <p className="font-medium text-foreground">
                                  Total: ${(parseFloat(paymentAmount) * (1 + parseFloat(gstPercentage) / 100)).toFixed(2)} {paymentCurrency.toUpperCase()}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleGenerateWithAI}
                  disabled={isGenerating}
                  className="w-full gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {content ? 'Regenerate Contract' : 'Generate with AI'}
                </Button>
              </div>

              {/* Right Column - Content Preview */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Contract Content</Label>
                  <ScrollArea className="h-[500px] border rounded-lg">
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Contract content will appear here after generation. You can edit it directly..."
                      className="min-h-[500px] border-0 resize-none font-mono text-sm"
                    />
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    You can edit the contract content directly. Changes will be saved when you click "Save Contract".
                  </p>
                </div>

                {content && (
                  <div className="space-y-2">
                    <Label>Revision Feedback</Label>
                    <div className="flex gap-2">
                      <Input
                        value={revisionFeedback}
                        onChange={(e) => setRevisionFeedback(e.target.value)}
                        placeholder="E.g., Make the payment terms stricter..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReviseWithAI}
                        disabled={isGenerating || !revisionFeedback.trim()}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating || !title || !content}>
              {isCreating || isUpdating ? 'Saving...' : 'Save Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Contract Dialog */}
      <GenerateContractShareLinkDialog
        open={!!shareDialogContract}
        onOpenChange={(open) => !open && setShareDialogContract(null)}
        contractId={shareDialogContract?.id || ''}
        contractTitle={shareDialogContract?.title || ''}
      />
    </div>
  );
}
