import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FileText, CheckCircle, Loader2, Download, AlertCircle, User, Building2, Calendar, Pen, CalendarIcon, CreditCard } from 'lucide-react';
import { useCanonicalRedirect } from '@/hooks/useCanonicalRedirect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePublicContract } from '@/hooks/useContractShareLinks';
import { useContractSignatures, SignatureInput } from '@/hooks/useContractSignatures';
import { SignatureCanvas } from '@/components/contract-signing/SignatureCanvas';
// downloadContractPdf is dynamically imported on demand — keeps jspdf out of the main bundle.
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PublicContractSign() {
  const { shareId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Redirect non-production hosts to production domain
  useCanonicalRedirect();
  
  const { data, isLoading, error, refetch } = usePublicContract(shareId);
  const { signatures, agencySignature, clientSignature, isFullySigned, addSignature, isSigning } = 
    useContractSignatures(data?.contract?.id);

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [activeTab, setActiveTab] = useState<'agency' | 'client'>('agency');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [intentConfirmed, setIntentConfirmed] = useState(false);
  const [consentToElectronic, setConsentToElectronic] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [signatureType, setSignatureType] = useState<'draw' | 'type'>('draw');
  const [signedDate, setSignedDate] = useState<Date>(new Date());

  // Handle payment status from URL params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast({
        title: 'Payment successful!',
        description: 'Your payment has been processed and the contract is complete.',
      });
      // Refetch to get updated payment status
      refetch();
    } else if (paymentStatus === 'cancelled') {
      toast({
        title: 'Payment cancelled',
        description: 'You can complete the payment later using the button below.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast, refetch]);
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Not Found or Expired</h2>
            <p className="text-muted-foreground">
              This contract signing link is no longer valid. Please contact the sender for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contract, client } = data;

  // Determine if payment is required and its status
  const paymentRequired = contract.payment_amount && contract.payment_amount > 0;
  const isPaid = contract.payment_status === 'paid';
  const isContractComplete = isFullySigned && (!paymentRequired || isPaid);

  const handleSign = async () => {
    if (!signerName.trim() || !signerEmail.trim() || !signatureData) {
      return;
    }

    const input: SignatureInput = {
      contract_id: contract.id,
      signer_role: activeTab,
      signer_name: signerName,
      signer_email: signerEmail,
      signer_title: signerTitle || undefined,
      intent_confirmed: intentConfirmed,
      consent_to_electronic: consentToElectronic,
      signature_data: signatureData,
      signature_type: signatureType,
    };

    addSignature(input, {
      onSuccess: () => {
        // If client just signed and payment is required, initiate payment
        if (activeTab === 'client' && paymentRequired && agencySignature) {
          initiatePayment();
        }
      }
    });
  };

  const resetForm = () => {
    setSignerName('');
    setSignerEmail('');
    setSignerTitle('');
    setIntentConfirmed(false);
    setConsentToElectronic(false);
    setSignatureData('');
    setSignedDate(new Date());
  };

  const initiatePayment = async () => {
    if (!shareId) return;
    
    setIsProcessingPayment(true);
    try {
      const { data: checkoutData, error } = await supabase.functions.invoke('create-contract-checkout', {
        body: { contract_id: contract.id, share_id: shareId }
      });

      if (error) throw error;
      if (checkoutData.error) {
        if (checkoutData.already_paid) {
          toast({ title: 'Payment already completed', description: 'This contract has already been paid.' });
          refetch();
          return;
        }
        throw new Error(checkoutData.error);
      }

      if (checkoutData.checkoutUrl) {
        window.location.href = checkoutData.checkoutUrl;
      }
    } catch (err) {
      console.error('Error initiating payment:', err);
      toast({
        title: 'Payment failed',
        description: err instanceof Error ? err.message : 'Could not start payment process',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDownloadPdf = async () => {
    const { downloadContractPdf } = await import('@/lib/contractPdf');
    downloadContractPdf(contract, client, {
      agencyName: 'Arris Studios',
      agencySignature: agencySignature ? {
        signer_name: agencySignature.signer_name,
        signer_title: agencySignature.signer_title || undefined,
        signature_data: agencySignature.signature_data || '',
        signed_at: agencySignature.signed_at || '',
      } : undefined,
      clientSignature: clientSignature ? {
        signer_name: clientSignature.signer_name,
        signer_title: clientSignature.signer_title || undefined,
        signature_data: clientSignature.signature_data || '',
        signed_at: clientSignature.signed_at || '',
      } : undefined,
    });
  };

  const canSign = signerName.trim() && signerEmail.trim() && signatureData && intentConfirmed && consentToElectronic;

  const renderSignatureBlock = (role: 'agency' | 'client', signature: typeof agencySignature) => {
    const label = role === 'agency' ? 'Agency Representative' : 'Client Representative';
    
    if (signature) {
      return (
        <div className="flex-1 p-6 border-2 border-green-200 rounded-lg bg-green-50/50">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{label}</div>
          {signature.signature_data && (
            <div className="h-16 mb-2">
              <img 
                src={signature.signature_data} 
                alt={`${signature.signer_name}'s signature`}
                className="h-full object-contain"
              />
            </div>
          )}
          <div className="border-t border-green-300 pt-2 space-y-1">
            <p className="font-medium text-sm">{signature.signer_name}</p>
            {signature.signer_title && (
              <p className="text-xs text-muted-foreground">{signature.signer_title}</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-green-700 mt-2 pt-2 border-t border-green-200">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="font-medium">
                Date: {signature.signed_at && format(new Date(signature.signed_at), 'MMMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 p-6 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{label}</div>
        <div className="h-16 mb-2 flex items-center justify-center">
          <Pen className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <div className="border-t border-muted-foreground/20 pt-2">
          <p className="text-sm text-muted-foreground italic">Awaiting signature...</p>
        </div>
      </div>
    );
  };

  const renderSigningForm = (role: 'agency' | 'client', existingSignature: typeof agencySignature) => {
    if (existingSignature) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">Signed by {existingSignature.signer_name}</p>
              <p className="text-sm text-green-600">
                {existingSignature.signed_at && format(new Date(existingSignature.signed_at), 'MMMM d, yyyy \'at\' h:mm a')}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${role}-name`}>Full Legal Name *</Label>
            <Input
              id={`${role}-name`}
              placeholder="Enter your full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${role}-email`}>Email Address *</Label>
            <Input
              id={`${role}-email`}
              type="email"
              placeholder="Enter your email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${role}-title`}>Title / Position</Label>
          <Input
            id={`${role}-title`}
            placeholder="e.g., Director, CEO, Account Manager"
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Signature *</Label>
          <SignatureCanvas 
            onSignatureChange={(data, type) => {
              setSignatureData(data);
              setSignatureType(type);
            }}
          />
        </div>

        {/* Date Signed Field - DocuSign Style */}
        <div className="space-y-2">
          <Label>Date Signed *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-11",
                  !signedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {signedDate ? format(signedDate, "MMMM d, yyyy") : <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={signedDate}
                onSelect={(date) => date && setSignedDate(date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            This date will appear on the signed contract
          </p>
        </div>

        <Separator />

        <div className="space-y-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-900">Legal Confirmations (Required)</h4>
          
          <div className="flex items-start space-x-3">
            <Checkbox
              id={`${role}-intent`}
              checked={intentConfirmed}
              onCheckedChange={(checked) => setIntentConfirmed(checked === true)}
            />
            <Label htmlFor={`${role}-intent`} className="text-sm text-amber-800 leading-relaxed">
              I confirm my intention to electronically sign this document and understand that this 
              will create a legally binding agreement under Australian law, including the 
              <em> Electronic Transactions Act 2000 (NSW)</em>.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id={`${role}-consent`}
              checked={consentToElectronic}
              onCheckedChange={(checked) => setConsentToElectronic(checked === true)}
            />
            <Label htmlFor={`${role}-consent`} className="text-sm text-amber-800 leading-relaxed">
              I consent to using electronic means to sign this contract and agree that my electronic 
              signature is the legal equivalent of my handwritten signature.
            </Label>
          </div>
        </div>

        <Button 
          onClick={handleSign}
          disabled={!canSign || isSigning}
          className="w-full"
          size="lg"
        >
          {isSigning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Sign Contract
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-6 h-6 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="font-semibold text-lg leading-tight truncate">{contract.title}</h1>
              <p className="text-sm text-muted-foreground truncate">
                {client?.business_name && `For ${client.business_name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {paymentRequired && (
              <Badge variant={isPaid ? 'default' : 'secondary'} className={isPaid ? 'bg-green-600' : ''}>
                {isPaid ? 'Paid' : `$${Number(contract.payment_amount).toFixed(0)} Due`}
              </Badge>
            )}
            <Badge variant={isContractComplete ? 'default' : 'secondary'}>
              {isContractComplete ? 'Complete' : isFullySigned ? 'Awaiting Payment' : 'Awaiting Signatures'}
            </Badge>
            <Button 
              size="sm" 
              variant={isFullySigned ? "default" : "outline"} 
              onClick={handleDownloadPdf}
            >
              <Download className="w-4 h-4 mr-2" />
              {isFullySigned ? 'Download Signed Contract' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Document Preview - Full width on top */}
          <div>
            {/* Document Container */}
            <div className="bg-background rounded-lg shadow-xl border overflow-hidden">
              {/* Document Header */}
              <div className="bg-muted/50 border-b px-8 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {contract.contract_type && (
                        <Badge variant="outline" className="text-xs">
                          {contract.contract_type}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-1">{contract.title}</h2>
                    <p className="text-muted-foreground">
                      {client?.business_name && `Prepared for ${client.business_name}`}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 justify-end">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(contract.created_at), 'MMMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Content */}
              <ScrollArea className="h-[600px]">
                <div className="p-8 md:p-12">
                  <div className="prose prose-sm md:prose-base max-w-none">
                    <div className="whitespace-pre-wrap font-serif text-foreground leading-relaxed">
                      {contract.content}
                    </div>
                  </div>

                  {/* Signature Blocks at the Bottom */}
                  <div className="mt-12 pt-8 border-t-2 border-muted">
                    <h3 className="text-lg font-semibold mb-6 text-center">Signatures</h3>
                    <div className="flex flex-col sm:flex-row gap-6">
                      {renderSignatureBlock('agency', agencySignature)}
                      {renderSignatureBlock('client', clientSignature)}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Audit Trail Below Document */}
            {signatures.length > 0 && (
              <Card className="mt-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Signature Audit Trail</CardTitle>
                  <CardDescription>Complete record of all signing activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {signatures.filter(s => s.signed_at).map((sig) => (
                      <div key={sig.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{sig.signer_name}</span>
                          <span className="text-muted-foreground"> ({sig.signer_role === 'agency' ? 'Agency' : 'Client'})</span>
                        </div>
                        <div className="text-muted-foreground">
                          {sig.signed_at && format(new Date(sig.signed_at), 'MMM d, yyyy \'at\' h:mm a')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Signing Panel - Below document */}
          <div>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pen className="w-5 h-5" />
                  Sign Contract
                </CardTitle>
                <CardDescription>
                  Both the agency and client must sign to complete the agreement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => {
                  setActiveTab(v as 'agency' | 'client');
                  resetForm();
                }}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="agency" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Agency
                      {agencySignature && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </TabsTrigger>
                    <TabsTrigger value="client" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Client
                      {clientSignature && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="agency">
                    {renderSigningForm('agency', agencySignature)}
                  </TabsContent>

                  <TabsContent value="client">
                    {renderSigningForm('client', clientSignature)}
                  </TabsContent>
                </Tabs>

                {/* Payment Required Notice - Show immediately when payment is needed */}
                {paymentRequired && !isPaid && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <CreditCard className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <h3 className="font-semibold text-amber-800">
                      {(contract as any).payment_type === 'recurring' ? (
                        <>
                          {(contract as any).initial_payment_amount && (contract as any).initial_payment_amount !== contract.payment_amount ? (
                            <>First payment: ${Number((contract as any).initial_payment_amount).toFixed(0)}, then ${Number(contract.payment_amount).toFixed(0)}/{(contract as any).billing_interval || 'month'}</>
                          ) : (
                            <>${Number(contract.payment_amount).toFixed(0)}/{(contract as any).billing_interval || 'month'} subscription</>
                          )}
                        </>
                      ) : (
                        <>Payment Required: ${Number(contract.payment_amount).toFixed(2)} {contract.payment_currency?.toUpperCase() || 'AUD'}</>
                      )}
                    </h3>
                    {!isFullySigned ? (
                      <p className="text-sm text-amber-600">
                        Both parties must sign before payment can be processed.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-amber-600 mb-4">
                          Contract fully signed. Complete payment to finalize.
                        </p>
                        <Button onClick={initiatePayment} disabled={isProcessingPayment}>
                          {isProcessingPayment ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              {(contract as any).payment_type === 'recurring' ? 'Start Subscription' : 'Complete Payment'}
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Contract Complete */}
                {isContractComplete && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <h3 className="font-semibold text-green-800">Contract Complete!</h3>
                    <p className="text-sm text-green-600">
                      {paymentRequired ? 'Both parties have signed and payment is complete.' : 'Both parties have signed. The contract is now legally binding.'}
                    </p>
                  </div>
                )}

                {/* Signatures complete but no payment required */}
                {isFullySigned && !paymentRequired && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <h3 className="font-semibold text-green-800">Contract Fully Signed!</h3>
                    <p className="text-sm text-green-600">
                      Both parties have signed. The contract is now legally binding.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legal Notice */}
            <div className="mt-4 text-center text-xs text-muted-foreground p-4">
              <p>
                This contract is governed by the laws of New South Wales, Australia. 
                Electronic signatures comply with the <em>Electronic Transactions Act 2000 (NSW)</em>.
              </p>
              <p className="mt-2 text-muted-foreground/50">
                Build: {import.meta.env.VITE_BUILD_ID || new Date().toISOString().slice(0, 10)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
